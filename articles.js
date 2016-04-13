var _ = require("lazy.js");
var osmosis = require("osmosis");
var moment = require("moment-timezone");
var ObjectId = require("bson-objectid");
var Rx = require("rx");
var db = require('mongoskin').db('mongodb://localhost:27017/test');

var images = [
  "0B0Nq2Tq_OeCiNjI0anlROFVZVkE",
  "0B0Nq2Tq_OeCiNG9Tdjd5eG1UdWM",
  "0B0Nq2Tq_OeCiYzdQWWF5VHFXTGc",
  "0B0Nq2Tq_OeCiZC1IZVgwM2FZRTg",
  "0B0Nq2Tq_OeCia3JyTWpVaWZLRUE",
  "0B0Nq2Tq_OeCiZ2xHcTZab3lfQ3M",
  "0B0Nq2Tq_OeCic21rZUpkZjE2REE",
  "0B0Nq2Tq_OeCidlBPZ1FYS3hCYmM",
  "0B0Nq2Tq_OeCiek1DN2VtUmpmMTg",
  "0B0Nq2Tq_OeCiVGtOY1lKNnJ2Z3c",
  "0B0Nq2Tq_OeCiVkJaZG1wX2ZTOWs",
  "0B0Nq2Tq_OeCia0hzLUNnSU54MW8",
  "0B0Nq2Tq_OeCiZkpwNWxfWlY1Mm8"
];

var itemStream = function(indexPage, follow, setter, paginate) {
  var stream = new Rx.Subject();
  var osm = osmosis.get(indexPage)
  if (paginate) {
    console.log("PAGINATE");
    osm = osm.paginate('.cat_stranicirane > span:not(.tochki_div):first + a', '.cat_stranicirane > a:last');
  }
  osm
  .follow(follow)
  .set(setter)
  .data(function(news) { stream.onNext(news); })
  .error(function(err) { stream.onError(err); })
  .done(function() { stream.onCompleted(); })

  return stream;
};

var articleStream = function(args) {
  var paginate = args.paginate === false ? false : true;
  return itemStream(
    args.indexPage,
    args.follow,
    {
      "title": { "bg": args.titleSelector},
      "details": ".div_pod > .cat_autor",
      "html": {"bg": ".div_pod + div:html"}
    },
    paginate
  );
};

var id = function(millis) {
  var timestamp = Math.floor(millis / 1000);
  var hex = ('00000000' + timestamp.toString(16)).substr(-8); // zero padding
  return new ObjectId(hex + new ObjectId().str.substring(8));
}

var handleArticle = function(article) {
  var details = article.details;
  delete article.details;

  _(details).split(",").each(function(element) {
    var element = element.trim();
    if (element.indexOf("от:") == 0) {
      article.author = {};
      article.author.bg = element.substring(3).trim();
    } else if (element.indexOf("дата:") == 0) {
      article.date = moment(element.substring(5).trim(), "DD.MM.YYYY").valueOf();
      article.publicationDate = article.date;
    }
  });
  article.id = id(article.date);
  article._id = article.id;
  article.itemId = article.id.toString(16);
  article.migrated = true;
  article.deleted = false;
  article.published = true;
  article.image = {
    "config" : {
      "fill" : true,
      "horizontalAlign" : "center",
      "verticalAlign" : "center"
    },
    "url" : "https://drive.google.com/uc?export=view&id=" + images[Math.floor(Math.random() * images.length)] + "&quot"
  }
  return article;
};

var handle = function(tag) {
  return function(news) {
    var  news = handleArticle(news)
    news.category = [tag];
    return news;
  }
};

var emisStream = function() {
  return Rx.Observable.concat(
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?catid=13' ,
      follow: '.item_block > .cat_title > p.cat_name > a',
      titleSelector: '.analysis_header > p'
    }),
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?catid=14' ,
      follow: '.item_block > .cat_title > p.cat_name > a',
      titleSelector: '.analysis_header > p',
      paginate: false
    }),
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?catid=33',
      follow: '.item_block > .cat_title > p.cat_name > a',
      titleSelector: '.analysis_header > p',
      paginate: false
    })
  ).map(handle("emis"));
};

var newsStream = function() {
  return Rx.Observable.concat(
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?class=3' ,
      follow: '.item_block > .cat_title > p.cat_name > a',
      titleSelector: '.news_header > p'
    }),
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?class=6',
      follow: ".initiatives_block > .cat_title > p.cat_name > a",
      titleSelector: '.initiatives_header > p'
    })
  ).map(handle("news"));
};

var summariesStream = function() {
  return Rx.Observable.concat(
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?class=4' ,
      follow: '.item_block > .cat_title > p.cat_name > a',
      titleSelector: '.blog_header > p'
    }),
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?catid=12',
      follow: ".item_block > .cat_title > p.cat_name > a",
      titleSelector: '.analysis_header > p'
    })
  ).map(handle("summaries"));
}

var insert = function(item) {
  if (item.date > moment("10.03.2016", "DD.MM.YYYY").valueOf()) {
    console.log("I am not going to insert that because its after 10.03.2016");
    return;
  }
  db.collection('articles').insert(item, function(err, result) {
    if (err) console.log("ERROR: " + item.title.bg + JSON.stringify(err));
    if (result) console.log('SUCCESS: ' + item.title.bg);
  });
};

emisStream().forEach(insert, function(err) {console.log("err:" + err);}, function() {
  newsStream().forEach(insert, function(err) {console.log("err:" + err);}, function() {
    summariesStream().forEach(insert, function(err) {console.log("err:" + err);}, function() {
      console.log("ALL DONE");
    });
  });
});

