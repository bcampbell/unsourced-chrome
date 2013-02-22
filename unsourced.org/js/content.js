
var label_template = '\
<div class="unsrced-label">\
\
  <img class="unsrced-label-icon" src="{{icon_url}}" alt="{{prettyname}}" />\
  <div class="unsrced-label-bod"><div class="unsrced-label-head">WARNING</div>\
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




function unsrced() {
  var u= $('body #unsrced');
  if(u.length == 0) {
    u = $('<div id="unsrced"></div>').appendTo($('body'));
  }
  return u;
}

function showWarningLabels( labels ) {
  console.log("Showing labels",labels);
  var overlay = unsrced();
  console.log(overlay);
  for(var idx=0; idx<labels.length; idx++) {
    var label = labels[idx];
    var html = render(label_template, label);
    $(html).hide().appendTo(overlay).fadeIn('fast');
  }


}




// recursively search node for strings.
// returns array of matches, of form [node,startpos,endpos,matchingstring]
/*
Based on jquery.highlight work by:
Marshal <beatgates@gmail.com>
Johann Burkard <http://johannburkard.de> <mailto:jb@eaio.com>

MIT license.
 
*/
function searchHTML(node,strings) {
  function reQuote(str) {
    // escape special regexp chars
    return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
  };

    // build strings into a single regexp
    var pats = [];
    for( var i=0; i<strings.length; ++i ) {
      pats.push( '(?:' + reQuote(strings[i]) + ')' );
    }
    var pattxt = "(" + pats.join('|') + ")";
    var pat = new RegExp(pattxt,"gi"); 

    function inner(node) {
      var results = [];
        if (node.nodeType === 3) { // 3 - Text node
          // NOTE: this relies on regexp having parentheses (ie capturing),
          // so the matching part shows up in the list returned by split()
          m = node.data.split(pat);
          var i=0;
          var pos=0;
          while((i+1)<m.length) {
            // every second item will be matching text
            pos += m[i].length;
            var end = pos + m[i+1].length;
            results.push( [node, pos, end, m[i+1]] );
            pos = end;
            i+=2;
          }
        } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName)) { // 1 - Element node
            for (var i = 0; i < node.childNodes.length; i++) {
                results.push.apply( results, inner(node.childNodes[i]));
            }
        }
        return results;
    }
 
    return inner(node);
};



// check the content of the page for various stuff
function examinePage() {

  var pageDetails = {};

  // search for text that might indicate an article requires sourcing...
  var indicators = ["scientists have", "scientists say",  "paper published", "research suggests", "latest research", "researchers", "the study"]
/* other possibilities:
  "according to a new study"
  "the study"
  "findings"
*/

  /* TODO: could check for obvious containers, to exclude menus, sidebars and other cruft */
  var hits = searchHTML(document.body, indicators);
  if(hits.length>0) {
    // looks like sourcing is needed...
    pageDetails.indicatorsFound = true;
  } else {
    pageDetails.indicatorsFound = false;
  }

  // if og:type is present, but not 'article', then we probably don't it
  pageDetails.ogType = $('meta[property="og:type"]').attr('content');
  return pageDetails;
}


/* chrome specifics */

// TODO: examine page upon document ready
/*
$(document).ready( function() {
  var pageDetails = examinePage();
  // tell main that doc is ready
  self.port.emit("contentReady", pageDetails);
});
*/


chrome.extension.onRequest.addListener( function(request, sender, response) {
  var method = request.method;
  if (method == 'showWarningLabels') {
    showWarningLabels(request.labels);
  } else if (method == 'examinePage') {
    response(examinePage());
  }

});


//console.log("content.js: F.A.B.");

