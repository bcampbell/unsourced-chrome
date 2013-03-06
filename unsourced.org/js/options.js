
document.addEventListener('DOMContentLoaded', function() {
  console.log("options.js: Hello!");

  $('#save').click( function(obj) {
    console.log("more-magic=", $('#more-magic').is(':checked') );

  });
});
