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


init_popup();

