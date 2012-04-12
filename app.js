var fs = require('fs'),
    express = require('express'),
    MemoryStore = express.session.MemoryStore,
    sessionStore = new MemoryStore(),
    routes = require('./routes'),
    database = require('./database'),
    user = require('./user');

var app = express.createServer();
module.exports = app;

var __dirname;

// Configuration

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set("view engine", "html");
  app.register(".html", require("jqtpl").express);
  app.set("view options", {layout: false});
  app.use(express.static(__dirname + '/public'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('secret'));
  app.use(express.session({
    store: sessionStore, 
    secret: 'secret', 
    key: 'express.sid', 
    cookie: {maxAge: 300000}
  }));
  app.use(user.middleware);
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});


// Routes
app.get('/', routes.index);
app.post('/login', routes.login);
app.get('/users', routes.manageusers);
app.post('/addusers', routes.addusers);
app.post('/deleteusers', routes.deleteusers);


app.listen(3000);
console.log("Express server listening on port %d in %s mode", 
  app.address().port, app.settings.env);