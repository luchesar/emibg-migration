var cachedModules=[],_=require("lazy.js"),osmosis=require("osmosis"),moment=require("moment-timezone"),ObjectId=require("bson-objectid"),Rx=require("rx"),db=require("mongoskin").db("mongodb://localhost:27017/test"),itemStream=function(e,t,i,a){var r=new Rx.Subject,n=osmosis.get(e);return a&&(console.log("PAGINATE"),n=n.paginate(".cat_stranicirane > span:not(.tochki_div):first + a",".cat_stranicirane > a:last")),n.follow(t).set(i).data(function(e){r.onNext(e)}).error(function(e){r.onError(e)}),r},articleStream=function(e){var t=e.paginate!==!1;return itemStream(e.indexPage,e.follow,{title:{bg:e.titleSelector},details:".div_pod > .cat_autor",html:{bg:".div_pod + div:html"}},t)},id=function(e){var t=Math.floor(e/1e3),i=("00000000"+t.toString(16)).substr(-8);return new ObjectId(i+(new ObjectId).str.substring(8))},handleArticle=function(e){var t=e.details;return delete e.details,_(t).split(",").each(function(t){var t=t.trim();0==t.indexOf("от:")?(e.author={},e.author.bg=t.substring(3).trim()):0==t.indexOf("дата:")&&(e.date=moment(t.substring(5).trim(),"DD.MM.YYYY").valueOf(),e.publicationDate=e.date)}),e.id=id(e.date),e._id=e.id,e.itemId=e.id.toString(16),e.migrated=!0,e.deleted=!1,e.published=!0,e.image={config:{fill:!0,horizontalAlign:"center",verticalAlign:"center"},url:"http://placehold.it/120x80"},e},handle=function(e){return function(t){var t=handleArticle(t);return t.category=[e],t}},newsStream=function(){return Rx.Observable.merge(Rx.Observable.merge(articleStream({indexPage:"http://www.emi-bg.com/index.php?catid=13",follow:".item_block > .cat_title > p.cat_name > a",titleSelector:".analysis_header > p"}),articleStream({indexPage:"http://www.emi-bg.com/index.php?catid=14",follow:".item_block > .cat_title > p.cat_name > a",titleSelector:".analysis_header > p",paginate:!1}),articleStream({indexPage:"http://www.emi-bg.com/index.php?catid=33",follow:".item_block > .cat_title > p.cat_name > a",titleSelector:".analysis_header > p",paginate:!1})).map(handle("emis")),Rx.Observable.merge(articleStream({indexPage:"http://www.emi-bg.com/index.php?class=3",follow:".item_block > .cat_title > p.cat_name > a",titleSelector:".news_header > p"}),articleStream({indexPage:"http://www.emi-bg.com/index.php?class=6",follow:".initiatives_block > .cat_title > p.cat_name > a",titleSelector:".initiatives_header > p"})).map(handle("news")),Rx.Observable.merge(articleStream({indexPage:"http://www.emi-bg.com/index.php?class=4",follow:".item_block > .cat_title > p.cat_name > a",titleSelector:".blog_header > p"}),articleStream({indexPage:"http://www.emi-bg.com/index.php?catid=12",follow:".item_block > .cat_title > p.cat_name > a",titleSelector:".analysis_header > p"})).map(handle("summaries")))},insert=function(e){return e.date>moment("10.03.2016","DD.MM.YYYY").valueOf()?void console.log("I am not going to insert that because its after 10.03.2016"):void db.collection("articles").insert(e,function(t,i){t&&console.log("ERROR: "+e.title.bg+JSON.stringify(t)),i&&console.log("SUCCESS: "+e.title.bg)})};newsStream().forEach(insert,function(e){console.log("err:"+e)});
//# sourceMappingURL=UGLIFY_SOURCE_MAP_TOKEN