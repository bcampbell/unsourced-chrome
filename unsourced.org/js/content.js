console.log("start content.js: F.A.B.");

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



// get or create the unsourced overlay element
function unsrced() {
  var u = document.querySelector('body #unsrced');
  if(u == null) {
    u = document.createElement('div');
    u.id = 'unsrced';
    document.querySelector('body').appendChild(u);
  }
  return u;
}



function showWarningLabels( labels ) {
  console.log("Showing labels",labels);
  var overlay = unsrced();
  console.log(overlay);
  for(var idx=0; idx<labels.length; idx++) {
    var label = labels[idx];
    var holder = document.createElement('div');
    holder.innerHTML = render(label_template, label);
    overlay.appendChild(holder.firstChild);
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

  var pd = {};

  {
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
      pd.indicatorsFound = true;
    } else {
      pd.indicatorsFound = false;
    }
  }


  // is an og:type metatag present?
  {
    pd.ogType = null;
    var meta_ogtype = document.querySelector('meta[property="og:type"]');
    if( meta_ogtype != null ) {
      if(meta_ogtype.content !== undefined) {
        pd.ogType = meta_ogtype.content;
      }
    }
  }

  // how about a schema.org type?
  {
    var container = document.querySelector('[itemscope][itemtype]')
    if( container != null ) {
      pd.schemaType = container.getAttribute('itemtype');
    } else {
      pd.schemaType = null;
    }
  }

  // hNews?
  {
    hnews = document.querySelector('.hnews')
    if( hnews != null ) {
      pd.hnews = true;
    } else {
      pd.hnews = false;
    }
  }


  var schemaorg_art_types = [
    "http://schema.org/Article",
    "http://schema.org/NewsArticle",
    "http://schema.org/BlogPosting",
    "http://schema.org/ScholarlyArticle",
    "http://schema.org/MedicalScholarlyArticle" ];

  /* now make a call - are we confident it is or isn't an article? */
  pd.isDefinitelyArticle = false;
  pd.isDefinitelyNotArticle = false;

  if(pd.schemaType !== null ) {
    if(schemaorg_art_types.indexOf(pd.schemaType) > -1 ) {
      pd.isDefinitelyArticle = true;
    } else {
      pd.isDefinitelyNotArticle = true;
    }
  }

  if( pd.ogType !== null ) {
    if( pd.ogType=='article') {
      pd.isDefinitelyArticle = true;
    } else {
      pd.isDefinitelyNotArticle = true;
    }
  }

  if( pd.hnews==true ) {
    pd.isDefinitelyArticle = true;
  }

  // could have conflicting info...
  if( pd.isDefinitelyArticle && pd.isDefinitelyNotArticle ) {
    // ignore all!
    pd.isDefinitelyArticle = false;
    pd.isDefinitelyNotArticle = false;
  }

  return pd;
}



/* chrome specifics */

chrome.extension.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log("content.js: received " + request.method);
    var method = request.method;
    if (method == 'showWarningLabels') {
      showWarningLabels(request.labels);
    }/* else if (method == 'examinePage') {
      sendResponse(examinePage());
    }*/
  }
);

// this content script file isn't even injected until the document is ready,
// so we can start work right away.
console.log("content.js: document ready");
chrome.extension.sendMessage({'method': 'pageExamined', 'pageDetails': examinePage()});

console.log("content.js: F.A.B.");

