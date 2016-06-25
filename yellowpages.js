var casper = require('casper').create();
var utils = require('utils');


var couchDB = 'http://localhost:5984/yellowpages/';

// Crawl Url
var url = 'http://www.yellowpages.co.th/';
var urlPath = '/en/ypsearch';

// Search Criteria
var category = 'Hospitals';
var place = 'Bangkok';

var urlProfilePath = '/en/profile/';

var companiesArr = [];
var companyList = [];

var companyListObj = {};
var companyDetail = {};

var recCount = 0;

casper.start();

// Initialize DB before start
casper.then(function(){
  this.open(couchDB,{
    method: 'delete'
  }).then(function(){
    this.open(couchDB,{
      method: 'put'
    }).then(function(){
      console.log('Finish DB Initialization');
      // Start crawling
      this.open(url+urlPath+'?q='+category+'&w='+place).then(function(){
        searchList.call(this);
      });
    });
  });

});


// Search through the list
function searchList() {
  console.log('Start Search List');

  this.waitFor(function check(){
    companyListObj = this.evaluate(function(companiesArr, category){
      var list = document.querySelectorAll('.yp-search-list.yp-check-login');
      var companyListBuf = [];
      for(var i=0;i<list.length;i++){
        var catBuf = list[i].querySelector('.yp-search-headding a').innerText;

        if(catBuf == category){

          var businessId = list[i].getAttribute('data-businessid');
          var company = list[i].querySelector('h3').innerText;
          if(companiesArr.indexOf(company) < 0){
            companyListBuf.push({
              businessId: businessId,
              company: company
            });
            companiesArr.push(company);
          }
        }
      }
      var res = {
          companyListBuf: companyListBuf,
          companiesArr: companiesArr
      };
      return res;
    }, {companiesArr: companiesArr, category: category});
    return companyListObj;

  }, getDetail);

}



// Get Detail of the Company
function getDetail(){
  console.log('Now for each page');

  companiesArr = companyListObj.companiesArr;
  companyList = companyListObj.companyListBuf;

  this.eachThen(companyList, function(res){
    console.log('Company: '+res.data.company);
    getCompanyDetail.call(this, res.data.businessId);
  }).then(function(){
    this.run(goNextPage);
  });
};


// Get Detail of the Company
function getCompanyDetail(businessId){
  console.log('Will Get BusinessId: '+businessId);

  this.open(url+urlProfilePath+businessId);
  this.waitFor(function check(){
    companyDetail = this.evaluate(function(businessId){
      var companyDetailBuf = {};
      companyDetailBuf.CompanyName = document.querySelector('.typ-profile-head-left h4').innerText.trim();
      companyDetailBuf.Category = document.querySelector('.typ-profile-head-left a').innerText.trim();
      var detailBuf = document.querySelectorAll('.typ-profile-left-detail tr');
      for(var i=0;i<detailBuf.length;i++){
        var tdBuf = detailBuf[i].querySelectorAll('td');
        companyDetailBuf[tdBuf[0].innerText.trim().replace(':','')] = tdBuf[1].innerText.trim();
      }
      if(document.querySelector('.typ-profile-head-left-tab p')){
        companyDetailBuf.Service = document.querySelector('.typ-profile-head-left-tab p').innerText.trim();
      }
      
      companyDetailBuf.BusinessId = businessId;
      return companyDetailBuf;

    }, {businessId: businessId});
    return companyDetail;
  }, sendToCouch);

}

// Send to CouchDB
function sendToCouch(){
  console.log('Sending to CouchDB');

  var uuid = new Date().toISOString();
  this.open(couchDB+uuid, {
    method: 'put',
    headers: {
      'Content-Type': 'application/json; charset=utf8'
    },
    encoding: "utf-8",
    data: companyDetail
  }).then(function(){
    recCount++;
    this.back();
    this.back();
  });
}


// Go next page
function goNextPage(){
  console.log('Go Next Page');
  if(this.exists('.pager__item--next a')){
    console.log('will click');
    this.click('.pager__item--next a');
    this.then(function(){
      console.log(this.getCurrentUrl());
      searchList.call(this);
    });
  } else {
    console.log('Run End in '+(Date.now() - startTime)+'ms');
    console.log(recCount+' Total Records');
    console.log(this.getCurrentUrl());
    this.exit();
  }
}

casper.on('remote.message', function(msg) {
    this.echo('remote message caught: ' + msg);
})

// First Run
var startTime = Date.now();
casper.run(goNextPage);



