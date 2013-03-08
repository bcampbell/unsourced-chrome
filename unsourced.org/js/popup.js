

Ashe.addModifiers({
    sourcelink: function(src) {
      if(src.title) { 
        return '<a target="_blank" href="' + src.url + '">' + src.title + '</a>';
      } else {
        var loc = parseUri(src.url);
        var title = {'pr':"Press release", 'paper': "Paper", 'other':"Other link"}[src.kind] || 'Source';
        return '<a target="_blank" href="' + src.url + '">' + title + '</a> (' + loc.host + ')';
      }
    }
    // , oneMoreModifier: function(str) { ... }
});



function display(tmplName,params)
{
    var template = document.getElementById(tmplName).innerHTML;
    var parsed = Ashe.parse(template, params);
    document.getElementById('content').innerHTML = parsed;
}


/* chrome specifics */


function init_popup()
{
  // var submit_url = getOptions().search_server + "/addarticle?url=" + encodeURIComponent(tab.url);

  // we want to pop it up on the currently-active tab
  chrome.tabs.query( {
    "windowId": chrome.windows.WINDOW_ID_CURRENT,
    "active": true
  }, function (tabs) {
    var tab=tabs[0];  // current tab

    console.log("Popup, for tab" + tab.id);

    var bg = chrome.extension.getBackgroundPage();
    var state = bg.TabTracker[tab.id];
    if( state === undefined ) {
      // not tracking this page
      var state = {
        "dummy": true,
        "lookupState": "none",
        "lookupDetails": null,
        'submit_url': null  // TODO! xyzzy
      };
    }
    state.debug_msg  = undefined;
    var debug_msg = JSON.stringify(state,null," ");
    state.debug_msg = debug_msg;

    display('popup-details-tmpl', state);

    // TODO: wire up any other javascript here (eg buttons)
    // (chrome extensions don't support any javascript in the html file,
    // so it's got to be done here
  });
}


chrome.extension.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log("popup.js: received " + request.method);
    var method = request.method;
    if (method == 'refresh_popup') {
      init_popup();
    }
  }
);


document.addEventListener('DOMContentLoaded', function() {
  init_popup();
});

