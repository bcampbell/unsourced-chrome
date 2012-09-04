$(document).ready(function() {

  function showDetails(artDetails) {

    var tmplName = artDetails.status=='found' ? 'popup-found-tmpl':'popup-notfound-tmpl';
    var template = document.getElementById(tmplName).innerHTML;
    var parsed = Ashe.parse(template, artDetails);
    document.getElementById('content').innerHTML = parsed;
  }


  /* jump through hoops to get tabid of tab which opened this popup.
     got to be a better way... */
  chrome.windows.getCurrent(function(win){ 
    var windowId = win.id; 
    chrome.tabs.getSelected(windowId, function(tab){ 
      var tabid = tab.id;
      var bg = chrome.extension.getBackgroundPage();
      /* check to see if background page has data associated with this tab */
      if(bg.TabTracker[tabid] !== undefined) {
        showDetails(bg.TabTracker[tabid].artDetails);
      }
    }); 
  }); 

});
