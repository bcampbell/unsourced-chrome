
var defaultOptions = {

  sites: [ 'scumways.com', 'www.dailymail.co.uk', 'lwn.net' ],
  search_server: "http://localhost:8888"
  //search_server: "http://unsourced.org"
};

var options = defaultOptions;


/* associative array holding tab states and details retreived from unsourced.org */  
tabTracker = {};


function updateTabState(tabid, values) {
  if(tabTracker[tabid] === undefined) {
    tabTracker[tabid] = {lookup: '', dom: '', artDetails: {}};
  }
  var state = tabTracker[tabid];

  var before = {dom: state.dom, lookup: state.lookup};

  for( var v in values ) {
    state[v] = values[v];
  }


  /* perform any side effects resulting from this state change */
  console.log( "tab " + tabid + " state change: " + before.lookup +"," + before.dom + " => " + state.lookup + "," + state.dom);
  if(state.lookup=='done' && state.dom=='completed') {
    if(before.lookup!='done' || before.dom!='completed') {
      // both the unsourced.org lookup and the page itself are ready.
      // thunderbirds are go!
      show_results(tabid, state.artDetails);
    }
  }
}


function onRequest(request, sender, sendResponse)
{
  console.log(request);

  var method = request.method;
  if(method=='feedMe') {
    sendResponse({'payload':'FOOOOOOOD!'});
  }
}


chrome.extension.onRequest.addListener(onRequest);


function is_news_site(url) {
  var loc = parseUri(url);
  for (var idx = 0; idx < options.sites.length; idx++) {
    if(loc.host==options.sites[idx]) {
      return true;
    }
  }
  return false;
}



var executeScriptsSynchronously = function (tab_id, files, callback) {
    if (files.length > 0) {
        var file = files[0];
        var rest = files.slice(1);
        chrome.tabs.executeScript(tab_id, {file: file}, function(){
            if (rest.length > 0) {
                executeScriptsSynchronously(tab_id, rest, callback);
            } else if (callback) {
                callback.call(null);
            }
        });
    }
};


/* */
function show_results(tabid, details) {
    if(details.status=='found') {
        chrome.pageAction.setIcon({'tabId': tabid, 'path': "img/icon.png"});
        chrome.pageAction.setPopup({'tabId': tabid, 'popup': "html/popup.html?"});
    } else {
        chrome.pageAction.setIcon({'tabId': tabid, 'path': "img/icon_off.png"});
    }
    chrome.pageAction.show(tabid);

    console.log("Inject content stuff into tab", tabid);
    /* inject the extra content scripts and css into the page */
    chrome.tabs.insertCSS(tabid, {file: "/css/churnalism.css"});
    chrome.tabs.insertCSS(tabid, {file: "/css/unsourced.css"});
    executeScriptsSynchronously(tabid, ["js/jquery.js", "js/content.js"],
        function() {

        /* pass the article details in to the content script to present */
        var req = {
           'method': 'augmentArticle',
           'artDetails': details, 
        };
        chrome.tabs.sendRequest(tabid, req);
        console.log("Req sent to tab ",tabid, req);
      });
}



function doLookup(tabid,url) {
  var search_url = options.search_server + '/api/lookup?' + $.param({'url':url});
  console.log("doLookup(",tabid,url,")");

  updateTabState(tabid, {lookup:'pending'});

  $.ajax({
    type: "GET",
    url: search_url,
    dataType: 'json',
    success: function(result) {
      console.log("Success:", result);
      /* store the fetched article details until the page is ready for them */
      updateTabState(tabid, {lookup:'done', artDetails:result});
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log("Error:", jqXHR, textStatus, errorThrown);
      updateTabState(tabid, {lookup:'done'});
    }
  });
}


chrome.webNavigation.onCommitted.addListener(function(details) {
  if (details.frameId != 0)
      return;

  var tabid = details.tabId;

  if(is_news_site(details.url)) {
    updateTabState(tabid,{dom:'committed'}); 
    doLookup(details.tabId, details.url);
  }
});


chrome.webNavigation.onCompleted.addListener(function(details) {
  if (details.frameId != 0)
      return;
  var tabid = details.tabId;
  if( tabTracker[tabid] === undefined )
      return;   /* not a news page */
  updateTabState(tabid,{dom:'completed'}); 
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  delete tabTracker[tabid];
});


console.log("F.A.B.");

