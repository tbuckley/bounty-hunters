var user = require('./user'),
    database = require('./database'),
    expose = require('./utils').expose(exports),
    async = require('async');

var INITIAL_POINTS = 4,
    KILL_PERCENT = 0.25;

var AWARD = 1,
    KILL  = 2;

var points = null,
    transactions = null;
database.notifications.once("open", function() {
  database.getCollection("points", function(err, collection) {
    points = collection;
  });
  database.getCollection("transactions", function(err, collection) {
    transactions = collection;
  });
});

/* User functions */

function initUser(user, cb) {
  points.insert({uid: user._id, points: INITIAL_POINTS}, function(err, doc) {
    cb(err);
  });
}

function getPoints(user, cb) {
  points.findOne({uid: user._id}, function(err, doc) {
    if(err || !doc) {
      cb(err);
    } else {
      cb(null, doc.points);
    }
  });
}


/* Helper functions */

function addPoints(amt, user, cb) {
  points.update({_id: user._id}, {$inc: {points: amt}}, cb);
}
function transferPoints(amt, src, dst, cb) {
  async.parallel([
    function(cb) {
      points.update({_id: src._id}, {$inc: {points: -amt}}, cb);
    },
    function(cb) {
      points.update({_id: dst._id}, {$inc: {points: amt}}, cb);
    }
  ], function(err) {
    if(err) {
      console.log("ERROR: points may be off:");
      console.log(amt, src, dst);
      cb(err);
    } else {
      cb();
    }
  });
}
function transferPercentage(per, src, dst, cb) {
  getPoints(src, function(err, points) {
    if(err) {
      cb(err);
    } else {
      transferPoints(Math.ceil(per * points), src, dst, cb);
    }
  });
}



/* Logged functions */

function kill(killer, killee, cb) {
  transactions.insert({
    time: (new Date()).getTime(),
    type: KILL,
    killer: killer._id,
    killee: killee._id
  }, function(err, doc) {
    if(err) {
      cb(err);
    } else {
      transferPercentage(KILL_PERCENT, killee, killer, cb);
    }
  });
}

function award(amt, user, msg, cb) {
  transactions.insert({
    time: (new Date()).getTime(),
    type: AWARD,
    amount: amt,
    message: msg
  }, function(err, doc) {
    if(err) {
      cb(err);
    } else {
      addPoints(amt, user);
    }
  });
}

expose(initUser, getPoints);
expose(kill, award);