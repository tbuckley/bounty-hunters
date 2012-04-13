var async = require('async'),
    _ = require('underscore'),
    database = require('./database'),
    _user = require('./user'),
    points = require('./points'),
    expose = require('./utils').expose(exports),
    mongo = require('mongodb');

var reporting = null;
database.notifications.once("open", function() {
  database.getCollection("reporting", function(err, collection) {
    reporting = collection;
  });
});

function getById(id, cb) {
  if(typeof id == 'string') {
    id = mongo.ObjectID.createFromHexString(id);
  }
  reporting.findOne({_id: id}, cb);
}
function removeById(id, cb) {
  if(typeof id == 'string') {
    id = mongo.ObjectID.createFromHexString(id);
  }
  reporting.remove({_id: id}, cb);
}

function reportKill(reporter, killer, killee, cb) {
  reporting.insert({
    time: (new Date()).getTime(),
    killer: killer._id,
    killee: killee._id,
    points: Math.ceil(killee.points * 0.25),
    reporter: reporter.username == killer.username ? killer._id : killee._id,
    confirmer: reporter.username == killer.username ? killee._id : killer._id
  }, cb);
}

function confirmReport(user, id, cb) {
  async.waterfall([
    function(cb) {
      getById(id, cb);
    },
    function(doc, cb) {
      async.parallel({
        killer: function(cb) {
          _user.getById(doc.killer, cb);
        },
        killee: function(cb) {
          _user.getById(doc.killee, cb);
        }
      }, function(err, results) {
        cb(err, doc, results);
      });
    },
    function(doc, results, cb) {
      points.addTransaction({
        time: (new Date()).getTime(),
        type: 2,
        killer: results.killer._id,
        killee: results.killee._id
      }, function(err) {
        cb(err, doc, results);
      });
    },
    function(doc, results, cb) {
      points.transferPoints(doc.points, results.killee, results.killer, function(err) {
        cb(err, doc);
      });
    },
    function(doc, cb) {
      removeById(doc._id, cb);
    }
  ], cb);
}

function cancelReport(user, id, cb) {
  removeById(id, cb);
}

function getReports(user, cb) {
  var template = _.template('\
  <form method="post" action="/report/<%= id %>"> \
    <div class="message"> \
      Did <span class="username"><%= username %></span> kill you? \
      <span class="bounty">(<%= points %>pt)</span> \
    </div> \
    <input type="submit" class="button" name="op" value="Confirm" /> \
    <input type="submit" class="button red" name="op" value="Deny" /> \
  </form> \
  ');
  reporting.find({confirmer: user._id}).sort({time: -1}).toArray(function(err, docs) {
    if(err) {
      cb(err);
    } else {
      async.map(docs, function(doc, cb) {
        console.log(doc, cb);
        _user.getById(doc.killer, function(err, user) {
          if(err) {
            cb(err);
          } else {
            var output = template({
              id: doc._id,
              username: user.name,
              points: doc.points
            });
            cb(null, output);
          }
        });
      }, function(err, reports) {
        console.log("reports", reports);
        cb(err, reports);
      });
    }
  });
}

expose(reportKill, confirmReport, cancelReport, getReports);