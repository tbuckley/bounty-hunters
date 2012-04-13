var _user = require('./user'),
    crypto = require('crypto'),
    _ = require('underscore'),
    async = require('async'),
    target = require('./target'),
    points = require('./points'),
    reporting = require('./reporting');

String.prototype.strip = function() {
  return this.replace(/^\s*(.*?)\s*$/, "$1");
};

function add_message(req, msg) {
  if(req.session && req.session.messages) {
    req.session.messages.push(msg);
    return true;
  } else if(req.session) {
    req.session.messages = [msg];
    return true;
  } else {
    return false;
  }
}
function get_messages(req) {
  var messages = req.session.messages;
  delete req.session['messages'];
  return messages;
}

var ctr = 0;
function generate_password() {
  var hash = crypto.createHash('md5');
  hash.update((new Date()).getTime().toString() + ctr);
  ctr += 1;
  return hash.digest('hex').substring(0,8);
}

exports.index = function(req, res, next) {
  async.parallel({
    players: function(cb) {
      _user.getAll(function(err, users) {
        if(err) {
          cb(err);
        } else {
          users = _.sortBy(users, function(user) { return -user.points;});
          cb(null, users);
        }
      });
    },
    user: function(cb) {
      cb(null, req.user);
    },
    activity: function(cb) {
      if(req.user) {
        points.activity(req.user, cb);
      } else {
        cb(null, []);
      }
    },
    messages: function(cb) {
      var m = get_messages(req);
      console.log("messages", m);
      cb(null, m);
    },
    reports: function(cb) {
      if(req.user) {
        reporting.getReports(req.user, cb);
      } else {
        cb(null, null);
      }
    }
  }, function(err, results) {
    res.render('index', results);
  });
};

exports.login = function(req, res, next) {
  var username = req.param('username'),
      password = req.param('password');
  _user.getByCredentials(username, password, function(err, user) {
    if(err) {
      add_message(err);
      res.redirect("/");
    } else {
      _user.login(req, user, function() {
        res.redirect('/');
      });
    }
  });
};

exports.manageusers = function(req, res, next) {
  _user.getAll(function(err, users) {
    res.render('addusers', {users: users});
  });
};
exports.addusers = function(req, res, next) {
  var data = req.param("users"),
      users = data.split("\n");
  users = _.map(users, function(user) {
    var bits = user.split('|');
    if(bits.length == 3) {
      var username = bits[0].strip(),
          email = bits[1].strip(),
          name = bits[2].strip();
      return {
        username: username,
        name: name,
        email: email,
        password: generate_password()
      };
    }
    return null;
  });
  users = _.compact(users);
  async.forEach(users, function(user, cb) {
    console.log(user);
    _user.create(user, cb);
  }, function(err) {
    target.randomLoop(function(err) {
      res.redirect('/users');
    });
  });
};
exports.deleteusers = function(req, res, next) {
  _user.deleteAll(function(err, docs) {
    console.log(err, docs);
    res.redirect('/users');
  });
};


exports.settarget = function(req, res, next) {
  if(req.user) {
    _user.getById(req.param('target_uid'), function(err, doc) {
      if(err || !doc) {
        console.log("not found...");
        res.redirect('/');
      } else {
        console.log("Set target:", doc);
        target.setTarget(req.user, doc, function(err) {
          res.redirect('/');
        });
      }
    });
  } else {  
    console.log("not logged in...");
    res.redirect('/');
  }
};

exports.report_death = function(req, res, next) {
  if(req.user) {
    _user.getByUsername(req.param('username'), function(err, killer) {
      if(err || !killer) {
        add_message('Error submitting death');
        res.redirect('/');
      } else {
        if(killer.target.username == req.user.username) {
          points.kill(killer, req.user, function(err) {
            res.redirect('/');
          });
        } else {
          add_message(req, 'That person is not currently hunting you.');
          res.redirect('/');
        }
      }
    });
  } else {
    console.log("not logged in");
    res.redirect('/');
  }
};

exports.report_kill = function(req, res, next) {
  if(req.user) {
    _user.getById(req.param('killee_uid'), function(err, killee) {
      if(err || !killee) {
        add_message('Error submitting kill');
        res.redirect('/');
      } else {
        if(req.user.target.username == killee.username) {
          reporting.reportKill(req.user, req.user, killee, function(err) {
            add_message('Reported kill, awaiting confirmation.');
            res.redirect('/');
          });
        } else {
          add_message(req, 'You are not currently hunting that person.');
          res.redirect('/');
        }
      }
    });
  } else {
    console.log("not logged in");
    res.redirect('/');
  }
};

exports.report = function(req, res, next) {
  var id = req.param('reportid'),
      op = req.param('op');
  if(op == 'Confirm') {
    reporting.confirmReport(req.user, id, function(err) {
      res.redirect('/');
    });
  } else if(op == 'Deny') {
    reporting.cancelReport(req.user, id, function(err) {
      add_message('Report cancelled');
      res.redirect('/');
    });
  } else {
    add_message('Invalid command');
    res.redirect('/');
  }
};