$(function() {
    (function(){
        // remove layerX and layerY
        var all = $.event.props,
        len = all.length,
        res = [];
        while (len--) {
            var el = all[len];
            if (el != 'layerX' && el != 'layerY') res.push(el);
        }
        $.event.props = res;
    }());

    function renderList (options) {
        $("#sites-list-container #sites-list").remove();

        var sites_list_tmpl = $("#sites-list-tmpl").html();

        options.sites.sort();
        var rendered = Ashe.parse(sites_list_tmpl, { sites: options.sites });

        $("#sites-list-container").append($(rendered));
    }

    function updateOptions(){
        var options = {
            search_server: searchServer(),
            submit_urls: submitUrls(),
            use_generic_news_pattern: useGenericNewsPattern(),
            include_local_news: includeLocalNews(),
            sites: []
        };
        $('#sites-list tbody td:first-child').each(function(i,el){
            options.sites.push($(el).text());
        });
        chrome.extension.sendRequest({method:"saveOptions", options:options});
    }

    function displayOptions(){
        chrome.extension.sendRequest({method:"getOptions"}, function(options){
            renderList(options);
            submitUrls(options['submit_urls']);
            searchServer(options['search_server']);
            useGenericNewsPattern(options['use_generic_news_pattern']);
            includeLocalNews(options['include_local_news']);
            chrome.extension.sendRequest({method:"getAllBrowserTabs"}, function(tabs){
                displayTabUrls(tabs, options);
            });
        });
    }

    function displayTabUrls (tabs, options) {
        if (tabs.length > 0) {
            $('#quickadd-list-container').empty();
        }

        var domains = 
            tabs.map(function(tab){
                return parseUri(tab.url);
            }).filter(function(uri){
                if ((uri.protocol != 'http') && (uri.protocol != 'https'))
                    return false;
                if (/\d{1,3}(\.\d{1,3}){3}/.test(uri.host))
                    return false;
                return true;
            }).map(function(uri){
                return '.' + reduce_host(without_www(uri.host));
            }).filter(function(uri){
                return (options.sites.indexOf(uri) == -1);
            }).reduce(function(prev,curr){
                if (prev.indexOf(curr) == -1)
                    prev.push(curr);
                return prev;
            }, []);

        domains.sort();
        var quickadd_list_tmpl = $("#quickadd-list-tmpl").html();
        var rendered = Ashe.parse(quickadd_list_tmpl, { domains: domains });
        $("#quickadd-list-container").empty().append($(rendered));
    }

    function useGenericNewsPattern (val) {
        if (val == null) {
            return ($("input#use-generic-news-pattern")[0].checked == true);
        } else if (val == true) {
            $("input#use-generic-news-pattern")[0].checked = true;
        } else {
            $("input#use-generic-news-pattern")[0].checked = undefined;
        }
    }

    function includeLocalNews (val) {
        if (val == null) {
            return ($("input#include-local-news")[0].checked == true);
        } else if (val == true) {
            $("input#include-local-news")[0].checked = true;
        } else {
            $("input#include-local-news")[0].checked = undefined;
        }
    }

    function submitUrls (val) {
        if (val == null) {
            return ($("input#submit-urls")[0].checked == true);
        } else if (val == true) {
            $("input#submit-urls")[0].checked = true;
        } else {
            $("input#submit-urls")[0].checked = undefined;
        }
    }

    /* TODO: KILL? */
    function searchServer (val) {
        if (val == null) {
            return $("input#search-server").val();
        } else {
            $("input#search-server").val(val);
            $("ul#search-server-params").empty();
            chrome.extension.sendRequest({'method': 'getParameters'}, function(params){
                var items = [];
                for (var key in params) {
                    items.push({'name': key, 'value': params[key]});
                }
                var server_params_tmpl = $("#server-params-tmpl").html();
                var rendered = Ashe.parse(server_params_tmpl, { params: items });
                $("ul#search-server-params").empty().append($(rendered));
            });
        }
    }

    var without_www = function (host) {
        return host.replace(/^www\./, '');
    };

    var reduce_host = function (host) {
        var host_pattern = /([^.]+\.(?:[a-z0-9]\.[a-z]{2}|[a-z]{3,4}))$/i;
        var offset = host.search(host_pattern);
        if (offset < 0) {
            return host;
        } else {
            return host.slice(offset);
        }
    };

    var add_manual_pattern = function (event) {
        event.preventDefault();
        var pattern = $("#host-preview").text().trim();

        var hostname_pattern = /^(?:(?:(?:(?:[a-zA-Z0-9][-a-zA-Z0-9]{0,61})?[a-zA-Z0-9])[.])*(?:[a-zA-Z][-a-zA-Z0-9]{0,61}[a-zA-Z0-9]|[a-zA-Z])[.]?)$/;
        var uri = parseUri(pattern);
        if (hostname_pattern.test(uri.host.replace(/^\./, '')) == false) {
            $("#host-warning").text("Pattern is invalid.");
        }

        chrome.extension.sendRequest({method: "addToWhitelist", site: pattern}, function(options){
            chrome.extension.sendRequest({method:"getAllBrowserTabs"}, function(tabs){
                renderList(options);
                displayTabUrls(tabs, options);
                $("#newSite input").val("");
                $("#newSite input").trigger("change");
            });
        });
    };

    $("#newSite").submit(add_manual_pattern);
    $("#manually-add-host").click(add_manual_pattern);

    $(document).ready(function(){
        $("#reset").click(function(){
            chrome.extension.sendRequest({method:"resetOptions"},function(response){
                displayOptions();
            });
        });

        $("#save").click(function(){
            updateOptions();
        });


        var preview_site_pattern = function (event) {
            var text = $("#newSite input").val();
            var uri = parseUri(text);
            var domain = null;
            /* most specific => subdomain + one level of path
             * somewhat specific => subdomain with any path
             * less specific => domain with any path
             * least specific => domain with prefix wildcard, any path
             */
            var specificity = $("#host-specificity").slider("value");
            if (specificity == 0) {
                domain = uri.host;
                if (uri.path.length > 0) {
                    var parts = uri.path.split('/');
                    domain += '/' + parts[1] + '/...';
                }
            } else if (specificity == 1) {
                domain = uri.host;
            } else if (specificity == 2) {
                domain = reduce_host(without_www(uri.host));
            } else {
                domain = '.' + reduce_host(without_www(uri.host));
            }
            $("#host-preview").text(domain);
            if (text == '') {
                $("#host-preview-container").hide();
            } else {
                $("#host-preview-container").show('fade');
            }
            $("#host-preview")[0].scrollIntoView();
        };

        $("#host-specificity").slider({
            min: 0, 
            max: 3,
            animate: true,
            change: function(event, ui){
                var labels = {
                    0: "Most specific",
                    1: "Somewhat specific",
                    2: "Less specific",
                    3: "Least specific"
                };
                var val = $(this).slider('value');
                $("#host-specificity-label").text(labels[val]);
                preview_site_pattern(event);
            }
        }).slider('value', 1);
        $("#newSite input").change(preview_site_pattern);
        $("#newSite input").keyup(function(event){ 
            if (event.keyCode == 8) { // Backspace
                $("#host-warning").text("");
            }
            setTimeout(function(){ preview_site_pattern(event); }, 0); 
        });
        try {
            $("#newSite input").bind('paste', function(){ $("#host-warning").text(""); });
            $("#newSite input").bind('paste', preview_site_pattern);
        } catch (e) {
            /* Ignore -- The paste event is undocumented so this block 
             * will ensure the rest of the .ready handler executes if 
             * the paste event ever changes on us. 
             */
        }

        $(".add-to-whitelist").live('click', function(){
            var pattern = $(this).parent().siblings('td:first-child').text();
            var that = this;
            chrome.extension.sendRequest({method: "addToWhitelist", site: pattern}, function(options){
                console.log(options);
                $(that).parent().parent().remove();
                renderList(options);
            });
            $("#newSite input").val("");
        });

        $(".delete").live('click',function(){
            var site = $(this).parent().prev().text();
            var that = this;
            chrome.extension.sendRequest({method: "removeFromWhitelist", site: site}, function(options){
                renderList(options);
                $(that).parent().parent().remove();
                chrome.extension.sendRequest({method:"getAllBrowserTabs"}, function(tabs){
                    displayTabUrls(tabs, options);
                });
            });
        });

        displayOptions();

        // Not really secret
        var secret_string = "dsfbf";
        var keypress_history = [];
        $("body").keypress(function(event){
            if (event.srcElement == this) {
                keypress_history.push(event.charCode);
                if (keypress_history.length > secret_string.length) {
                    keypress_history.shift();
                }
                var keypress_history_string = String.fromCharCode.apply(null, keypress_history);
                if (keypress_history_string == secret_string) {
                    $("#search-server-header, #search-server-content").show();
                }
            }
        });

        $(window).unload(function(){
            updateOptions();
        });
    });
});
