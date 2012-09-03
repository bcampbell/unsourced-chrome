
var label_template = '\
<div class="unsourced-label">\
\
  <img class="unsourced-label-icon" src="{{icon_url}}" alt="{{prettyname}}" />\
  <div class="unsourced-label-bod"><div class="unsourced-label-head">WARNING</div>\
  {{description}}\
  </div>\
</div>\
';


/* cheesy little template system, eg "Hello, {{name}}!" */
function render(tmpl, values) {
  var regex = /\{\{\s*(.*?)\s*\}\}/gi;
  return tmpl.replace(regex, function(m,p1) {
    return values[p1];
  });
}




function augmentArticle(artDetails) {
  console.log("Augmenting article ",artDetails);
  $('body').append('<div id="unsourced-overlay"></div>');
  if( artDetails.status == 'found' ) {
    /* show warning labels */  
    for(var idx=0; idx<artDetails.labels.length; idx++) {
      var label = artDetails.labels[idx];
      var html = render(label_template, label);
      $('#unsourced-overlay').append(html);
    }
  } else {
  }
}



var handleMessage = function (request, sender, response) {
    var method = request.method;
    if (method =='augmentArticle') {
      augmentArticle(request.artDetails);
    }
};

chrome.extension.onRequest.addListener(handleMessage);

//console.log("content.js: F.A.B.");

