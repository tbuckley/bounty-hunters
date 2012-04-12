var _user = require('./user'),
    crypto = require('crypto'),
    _ = require('underscore'),
    async = require('async'),
    target = require('./target');

String.prototype.strip = function() {
  return this.replace(/^\s*(.*?)\s*$/, "$1");
};

var ctr = 0;
function generate_password() {
  var hash = crypto.createHash('md5');
  hash.update((new Date).getTime().toString() + ctr);
  ctr += 1;
  return hash.digest('hex').substring(0,8);
}

exports.index = function(req, res, next) {
  _user.getAll(function(err, users) {
    users = _.sortBy(users, 'points');
    res.render('index', {user: req.user, players: users});
  });
};

exports.login = function(req, res, next) {
  var username = req.param('username'),
      password = req.param('password');
  _user.getByCredentials(username, password, function(err, user) {
    if(err) {
      res.render('index', {err: err, user: null});
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
}