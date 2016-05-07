var _ = require("lazy.js");
var osmosis = require("osmosis");
var moment = require("moment-timezone");
var ObjectId = require("bson-objectid");
var Rx = require("rx");
var db = require('mongoskin').db(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME);
var request = require('request');
var cheerio = require('cheerio');

/*console.log("fetching an article");
request("http://www.emi-bg.com/index.php?id=1827", function(error, response, body) {
  if (!error && response.statusCode == 200) {
    var $ = cheerio.load(body, {decodeEntities: false});
    console.log($(".div_pod + div").html())

    //console.log("response body:" + body)
  }
});*/

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

var itemStream = function(indexPage, setter, paginate) {
  var stream = new Rx.ReplaySubject();
  var osm = osmosis.get(indexPage);
  if (paginate) {
    osm = osm.paginate('.cat_stranicirane > span:not(.tochki_div):first + a', '.cat_stranicirane > a:last');
  }
  osm
  .find(setter)
  .set('location')
  .data(function(news) { stream.onNext(news); })
  .error(function(err) { stream.onError(JSON.stringify(err)); })
  .done(function() { stream.onCompleted(); })

  return stream;
};

var articleStream = function(args) {
  var paginate = args.paginate === false ? false : true;
  return Rx.Observable.zip(
    itemStream(
      args.indexPage,
      args.selector,
      paginate
    ),
    Rx.Observable.interval(700),
    function(item, interval) {return item;}
  )
  .map(function(link) {
    return 'http://www.emi-bg.com/index.php' + link.location;
  }, function(){})
  .flatMapObserver(function(url) {
    var result = new Rx.ReplaySubject();
    request(url, function(error, response, body) {
      if (error) result.onError(error);
      else if (response.statusCode == 200) {
        var $ = cheerio.load(body, {decodeEntities: false});
        var r = {
          "title": { "bg": $(args.titleSelector).text()},
          "details": $(".div_pod > .cat_autor").text(),
          "html": {"bg": $(".div_pod + div").html()}
        };
        result.onNext(r);
      } else {
        result.onError("Fetching url:" + url + " rturned status:" + response.statusCode);
      }
      result.onCompleted();
    });
    return result;
  }, function(err){return Rx.Observable.empty();}, function(){return Rx.Observable.empty();});
};

var id = function(millis) {
  var timestamp = Math.floor(millis / 1000);
  var hex = ('00000000' + timestamp.toString(16)).substr(-8); // zero padding
  return new ObjectId(hex + new ObjectId().str.substring(8));
}

var handleArticle = function(article) {
  var details = article.details;
  //console.log("article:" + JSON.stringify(article));
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
  article.html.bg = article.html.bg.replace('style="margin-left:30px;margin-top:20px;width:675px;display:table;"', '');
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
      selector: '.item_block > .cat_title > p.cat_name > a@href',
      titleSelector: '.analysis_header > p'
    }),
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?catid=14' ,
      selector: '.item_block > .cat_title > p.cat_name > a@href',
      titleSelector: '.analysis_header > p',
      paginate: false
    }),
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?catid=33',
      selector: '.item_block > .cat_title > p.cat_name > a@href',
      titleSelector: '.analysis_header > p',
      paginate: false
    })
  ).map(handle("emis"));
};

var newsStream = function() {
  return Rx.Observable.concat(
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?class=3' ,
      selector: '.item_block > .cat_title > p.cat_name > a@href',
      titleSelector: '.news_header > p'
    }),
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?class=6',
      selector: ".initiatives_block > .cat_title > p.cat_name > a@href",
      titleSelector: '.initiatives_header > p'
    })
  ).map(handle("news"));
};

var summariesStream = function() {
  return Rx.Observable.concat(
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?class=4' ,
      selector: '.item_block > .cat_title > p.cat_name > a@href',
      titleSelector: '.blog_header > p'
    }),
    articleStream({
      indexPage: 'http://www.emi-bg.com/index.php?catid=12',
      selector: ".item_block > .cat_title > p.cat_name > a@href",
      titleSelector: '.analysis_header > p'
    })
  ).map(handle("summaries"));
}

var insert = function(item) {
  if (item.date > moment("10.03.2016", "DD.MM.YYYY").valueOf()) {
    console.log("I am not going to insert that because its after 10.03.2016 item type:" + item.category);
    return;
  }
  db.collection('articles').insert(item, function(err, result) {
    if (err) console.log("ERROR: " + item.title.bg + JSON.stringify(err));
    if (result) console.log('SUCCESS: ' + item.title.bg + " item type:" + item.category);
  });
};

Rx.Observable.concat(
  summariesStream(), newsStream(), emisStream()
)
.scan(function(prev, current, i) {
  current.image.url = "https://drive.google.com/uc?export=view&id=" + images[i % images.length] + "&quot"
  return current;
})
.forEach(insert, function(err) {console.log("err:" + err);}, function() {console.log("Completed");process.exit(0);});

/*articleStream({
  indexPage: 'http://www.emi-bg.com/index.php?catid=13' ,
  selector: '.item_block > .cat_title > p.cat_name > a@href',
}).forEach(function(link) {console.log(link);})
emisStream().forEach(insert, function(err) {console.log("err:" + err);}, function() {
  newsStream().forEach(insert, function(err) {console.log("err:" + err);}, function() {
    summariesStream().forEach(insert, function(err) {console.log("err:" + err);}, function() {
      console.log("ALL DONE");
    });
  });
});*/

