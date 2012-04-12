var crypto = require('crypto'),
    async = require('async'),
    database = require('./database'),
    expose = require('./utils').expose(exports),
    mongo = require('mongodb'),
    points = require('./points'),
    target = require('./target');

var db = null;
database.notifications.once("open", function() {
  database.getCollection("users", function(collection, cb) {
    collection.createIndex("username", {unique: true}, cb);
  }, function(err, collection) {
    db = collection;
  });
});


/* Hash a password */

function hash_password(password) {
  var hash = crypto.createHash('md5');
  hash.update(password);
  return hash.digest('hex');
}

function middleware(req, res, next) {
  if(req.session.uid) {
    getById(req.session.uid, function(err, user) {
      if(!err) {
        req.user = user;
      }
      next();
    });
  } else {
    next();
  }
}

/* Create a user */

function create(properties, cb) {
  async.waterfall([
    function(cb) {
      if(!properties.username || !properties.username) {
        cb("Missing username/password!");
      } else {
        properties['username'] = properties['username'].toLowerCase();
        properties['password'] = hash_password(properties['password']);
        cb(null, properties);
      }
    },
    function(user, cb) {
      db.insert(user, cb);
    },
    function(user, cb) {
      user = user[0];
      async.parallel([
        function(cb) {
          points.initUser(user, cb);
        }
      ], function(err, results) {
        cb(err, user);
      });
    }
  ], cb);
}


/* Get a user */
function loadUserData(user, cb) {
  var args = Array.prototype.slice.apply(arguments);
  var options = null;
  if(args.length == 3) {
    options = cb;
    cb = args[2];
  } else {
    options = {
      getTarget: true
    };
  }
  user.name = user.name || 'Anonymous User';
  user.profile_photo = user.profile_photo || '/images/default_profile.jpg';
  async.parallel({
    points: function(cb) {
      points.getPoints(user, cb);
    },
    target: function(cb) {
      if(options.getTarget) {
        target.getTarget(user, cb);
      } else {
        cb(null, null);
      }
    },
    numHunters: function(cb) {
      target.getNumHunters(user, cb);
    }
  }, function(err, results) {
    if(err) {
      cb(err);
    } else {
      user.points = results.points;
      user.bounty = Math.ceil(0.25 * results.points);
      user.target = results.target;
      user.numHunters = results.numHunters;
      cb(null, user);
    }
  });
}
function getHandler(cb, errMsg, options) {
  options = options || {
    getTarget: true
  };
  return function(err, user) {
    if(err) {
      cb(err);
    } else if(user === null) {
      cb(errMsg || "Invalid user request");
    } else {
      loadUserData(user, options, cb);
    }
  };
}

function getById(id, cb, options) {
  if(typeof id == 'string') {
    id = mongo.ObjectID.createFromHexString(id);
  }
  db.findOne({_id: id}, getHandler(cb, null, options));
}
function getByUsername(username, cb) {
  username = username.toLowerCase();
  db.findOne({username: username}, getHandler(cb, "Username doesn't exist"));
}
function getByCredentials(username, password, cb) {
  username = username.toLowerCase();
  db.findOne({
    username: username,
    password: hash_password(password)
  }, getHandler(cb, "Incorrect username/password"));
}


function usernameExists(username, cb) {
  getByUsername(username, function(err, doc) {
    cb(err, doc !== null);
  });
}
function login(req, user, cb) {
  req.session.uid = user._id.toHexString();
  cb();
}

function deleteAll(cb) {
  db.remove({}, cb);
}
function getAll(cb) {
  db.find({}).toArray(function(err, docs) {
    async.map(docs, loadUserData, cb);
  });
}

expose(middleware, login);
expose(create, getById, getByUsername, getByCredentials, usernameExists);
expose(getAll, deleteAll);