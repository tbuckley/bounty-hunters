var _user = require('./user'),
    database = require('./database'),
    expose = require('./utils').expose(exports),
    async = require('async'),
    _ = require('underscore'),
    dateFormat = require('dateformat');

var INITIAL_POINTS = 4,
    KILL_PERCENT = 0.333;

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
  points.update({uid: user._id}, {$inc: {points: amt}}, cb);
}
function transferPoints(amt, src, dst, cb) {
  async.parallel([
    function(cb) {
      points.update({uid: src._id}, {$inc: {points: -amt}}, cb);
    },
    function(cb) {
      points.update({uid: dst._id}, {$inc: {points: amt}}, cb);
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
    uid: user._id,
    amount: amt,
    message: msg
  }, function(err, doc) {
    if(err) {
      cb(err);
    } else {
      addPoints(amt, user, cb);
    }
  });
}

function addTransaction(trans, cb) {
  transactions.insert(trans, cb);
}

function activity(user, cb) {
  var template = _.template(" \
  <li> \
    <div class=\"message\"> \
      <%= message %> \
    </div> \
    <div class=\"time\"><%= time %></div> \
  </li> \
  ");
  transactions.find({$or: [{killer: user._id}, {killee: user._id}]})
    .sort({time: -1})
    .toArray(function(err, docs) {
      if(err) {
        cb(err);
      } else {
        async.map(docs, function(doc, cb) {
          if(doc.type == KILL) {
            console.log(doc.killer, user._id, doc.killer == user._id);
            if(doc.killer.toHexString() == user._id.toHexString()) {
              _user.getById(doc.killee, function(err, killee) {
                cb(null, template({
                  message: "You killed <span class=\"username\">"+killee.name+'</span>',
                  time: dateFormat(new Date(doc.time), "h:MMtt m/dd")
                }));
              });
            } else {
              _user.getById(doc.killer, function(err, killer) {
                cb(null, template({
                  message: "<span class=\"username\">"+killer.name+'</span> killed you',
                  time: dateFormat(new Date(doc.time), "h:MMtt m/dd")
                }));
              });
            }
          } else if(doc.type == AWARD) {
            cb(null, template({
              message: doc.message,
              time: dateFormat(new Date(doc.time), "h:MMtt m/dd")
            }));
          }
        }, cb);
      }
    });
}

expose(initUser, getPoints);
expose(kill, award, activity, transferPoints, transferPercentage, addTransaction);