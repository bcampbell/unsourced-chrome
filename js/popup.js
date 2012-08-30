var tmpl = "\
<h2>{{headline}}</h2>\
<ul>\
<li>{{permalink}}</li>\
</ul>\
";

/* cheesy little template system, eg "Hello, {{name}}!" */
function render(tmpl, values) {
  var regex = /\{\{\s*(.*?)\s*\}\}/gi;
  return tmpl.replace(regex, function(m,p1) {
    return values[p1];
  });
}


$(document).ready(function() {

  function render(art) {
    $('#headline').text(art.headline);
    $('#unsourced-link').attr('href',  art.unsourced_url);

    for(var idx=0; idx<art.sources.length; idx++) {
      var src = art.sources[idx];
      var li = $('#srcs li.template').clone();
      $(li).removeAttr('style').removeClass('template');
 
      $(li).find('.src-link').text(src.url);
      $(li).find('.src-link').attr('href',src.url);
      $(li).find('.src-publication').text(src.publication);
      $(li).find('.src-pubdate').text(src.pubdate);
 
      $(li).appendTo('#srcs');
    }
  }



  chrome.windows.getCurrent(function(win){ 
    var windowId = win.id; 
    chrome.tabs.getSelected(windowId, function(tab){ 
      var tabid = tab.id;
      console.log("TABID=",tabid); 
      var bg = chrome.extension.getBackgroundPage();
      if(bg.tabTracker[tabid] !== undefined) {
        var details = bg.tabTracker[tabid].artDetails;
        render(details);
     }
    }); 
  }); 

});
