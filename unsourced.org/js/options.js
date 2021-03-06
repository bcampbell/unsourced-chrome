
document.addEventListener('DOMContentLoaded', function() {
  console.log("options.js: Hello!");

  var bg = chrome.extension.getBackgroundPage();

  function show() {
    var opts = bg.options;

    var whitelist = document.getElementById('user-whitelist');
    var whitelist_str = opts.user_whitelist.join("\n");
    whitelist.defaultValue = whitelist_str; // so revert button will work
    $(whitelist).val(whitelist_str);

    var builtin_whitelist = document.getElementById('builtin-whitelist');
    var builtin_whitelist_str = bg.getBuiltInWhiteList().join("\n");
    builtin_whitelist.defaultValue = builtin_whitelist_str; // so revert button won't screw up the display :-)
    $(builtin_whitelist).val(builtin_whitelist_str);

/*    var blacklist = document.getElementById('user-blacklist');
    var blacklist_str = opts.user_blacklist.join("\n");
    blacklist.defaultValue = blacklist_str; // so revert button will work
    $(blacklist).val(blacklist_str);
*/
    $('#debug').prop('checked', opts.debug);
    $('#show-overlays').prop('checked', opts.show_overlays);
  }

  function fetch() {
    var opts = {};
    opts.user_whitelist = $("#user-whitelist").val().split("\n");
    opts.user_whitelist = opts.user_whitelist.filter(function(a) {return a.trim()!="";});

//    opts.user_blacklist = $("#user-blacklist").val().split("\n");
//    opts.user_blacklist = opts.user_blacklist.filter(function(a) {return a.trim()!="";});


    opts.debug = $('#debug').prop('checked');
    opts.show_overlays = $('#show-overlays').prop('checked');
//is(':checked');
    return opts;
  }


  $('#save').click( function(obj) {
    var new_opts = fetch();
    bg.storeOptions(new_opts);
  });


  show();

});
