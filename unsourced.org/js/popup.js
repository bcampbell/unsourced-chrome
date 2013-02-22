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
      var dummy_state = {
        "lookupState": "none",
        "lookupDetails": null,
        'submit_url': null  // TODO! xyzzy
      };

      display('popup-details-tmpl', dummy_state);
      // not tracking this page
    } else {
      display('popup-details-tmpl', state);
    }
  });
}

chrome.extension.onRequest.addListener( function(request, sender, response) {
  var method = request.method;
  if (method == 'refresh') {
    init_popup();
  }
});

init_popup();

