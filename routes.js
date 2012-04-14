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
      add_message(req, err);
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
    if(bits.length == 5) {
      var name = bits[0].strip(),
          nickname = bits[1].strip(),
          phone = bits[2].strip().replace(/[^0-9\+]/g, ''),
          email = bits[4].strip();
      var names = name.split(/[^a-zA-Z]/),
          username = (_.first(names).strip()[0] + _.last(names).strip()).toLowerCase();
      return {
        username: username,
        nickname: nickname,
        name: name,
        email: email,
        phone: phone,
        password: generate_password()
      };
    }
    return null;
  });
  users = _.compact(users);
  async.forEach(users, function(user, cb) {
    console.log(user.username +'\t'+ user.password +'\t' + user.email);
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
        add_message(req, "ERROR: Target not found...");
        res.redirect('/');
      } else {
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
        add_message(req, 'Error submitting death');
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
        add_message(req, 'Error submitting kill');
        res.redirect('/');
      } else {
        if(req.user.target.username == killee.username) {
          if(req.user.timeToKill) {
            console.log("HERE");
            add_message(req, 'You cannot kill that person yet.');
            res.redirect('/');
          } else {
            console.log("HERE2", req.user);
            reporting.reportKill(req.user, req.user, killee, function(err) {
              add_message(req, 'Reported kill, awaiting confirmation.');
              res.redirect('/');
            });
          }
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
      add_message(req, 'Report cancelled');
      res.redirect('/');
    });
  } else {
    add_message(req, 'Invalid command');
    res.redirect('/');
  }
};