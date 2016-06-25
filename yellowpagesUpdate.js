/*
CouchDB updating script
*/

var casper = require('casper').create();
var utils = require('utils');


var couchDB = 'http://localhost:5984/yellow-hospitals/';
var emailView = '_design/company/_view/list-by-email/';

var getHeaders = {
  headers: {
    'Accept': 'application/json; charset=utf8'
  },
  encoding: "utf-8",
  method: 'get'
}

// For Pagination
var limit = 10;
var page = 0;
var skip = 0;

var gotData = null;

casper.start();

casper.then(function(){
  getFromCouch.call(this);
});


function getFromCouch(){
  this.echo(couchDB+emailView+'?limit='+limit+'&skip='+skip);
  
  this.open(couchDB+emailView+'?limit='+limit+'&skip='+skip, getHeaders).then(function(){
    utils.dump(JSON.parse(this.getPageContent()));
    var data = JSON.parse(this.getPageContent());
    var rows = data.rows;

    this.eachThen(rows, function(res){
      this.open(couchDB+res.data.id, getHeaders).then(function(){
        this.waitFor(function check(){
          return this.getPageContent();
        }, sendToCouch);
      });
    }).then(function(){
      if(hasNext(data.total_rows) && rows.length > 0){
        prepNext(data.offset);
        this.run(getFromCouch);
      }else{
        console.log('End in '+(Date.now() - startTime)+'ms');
        this.exit();
      }
    });
  });
}

function hasNext(total_rows){
  var last_page = Math.floor(total_rows / limit) + (total_rows % limit ? 1 : 0);
  return page != last_page;
}

function prepNext(offset){
  page = (offset / limit) + 1;
  skip = page * limit;
}

// Send to CouchDB
function sendToCouch(){
  var data = JSON.parse(this.getPageContent());
  var uuid = data._id;
  delete data._id;
  console.log('Sending to CouchDB '+uuid);
  data.fare = '';
  data.lang = '';
  data.status = '';
  
  this.open(couchDB+uuid, {
    method: 'put',
    headers: {
      'Content-Type': 'application/json; charset=utf8'
    },
    encoding: "utf-8",
    data: data
  });
  this.waitFor(function check(){
    return this.getPageContent();
  }, function(){
    utils.dump(JSON.parse(this.getPageContent()));
  });
}

casper.on('remote.message', function(msg) {
    this.echo('remote message caught: ' + msg);
})

// First Run
var startTime = Date.now();
casper.run(getFromCouch);




