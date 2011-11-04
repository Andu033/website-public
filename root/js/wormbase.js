/*!
 * WormBase
 * http://wormbase.org/
 *
 * WormBase copyright © 1999-2011 
 * California Institute of Technology, 
 * Ontario Institute for Cancer Research,
 * Washington University at St. Louis, and 
 * The Wellcome Trust Sanger Institute.
 *
 * WormBase is supported by a grant from the 
 * National Human Genome Research Institute at the 
 * US National Institutes of Health # P41 HG02223 and the 
 * British Medical Research Council.
 *
 * author: Abigail Cabunoc 
 *         abigail.cabunoc@oicr.on.ca
 */

+function(window, document, undefined){ 
  var location = window.location,
      $jq = jQuery.noConflict();
     
  var WB = (function(){
    var timer,
        notifyTimer,
        cur_search_type = 'all',
        reloadLayout = 0, //keeps track of whether or not to reload the layout on hash change
        loadcount = 0,
        plugins = new Array(),
        loading = false;
    
    function init(){
      var pageInfo = $jq("#header").data("page"),
          searchAll = $jq("#all-search-results"),
          sysMessage = $jq("#top-system-message").children(".system-message-close"),
          history_on = (pageInfo['history'] == 1) ? 1 : undefined;

      if(history_on){
        $jq.post("/rest/history", { 'ref': pageInfo['ref'] , 'name' : pageInfo['name'], 'id':pageInfo['id'], 'class':pageInfo['class'], 'type': pageInfo['type'], 'is_obj': pageInfo['is_obj'] });
      }
      
      if($jq(".user-history").size()>0){
        histUpdate(history_on);
      }
      

      
      search_change(pageInfo['class']);
      if(sysMessage.size()>0) {systemMessage('show'); sysMessage.click(function(){ systemMessage('hide', sysMessage.data("id")); });}

      if(searchAll.size()>0) { 
        var searchInfo = searchAll.data("search");
        allResults(searchInfo['type'], searchInfo['species'], searchInfo['query']);
      } 

      Breadcrumbs.init();
      comment.init(pageInfo);
      issue.init(pageInfo);
        
      if($jq(".star-status-" + pageInfo['wbid']).size()>0){$jq(".star-status-" + pageInfo['wbid']).load("/rest/workbench/star?wbid=" + pageInfo['wbid'] + "&name=" + pageInfo['name'] + "&class=" + pageInfo['class'] + "&type=" + pageInfo['type'] + "&id=" + pageInfo['id'] + "&url=" + pageInfo['ref'] + "&save_to=" + pageInfo['save'] + "&is_obj=" + pageInfo['is_obj']);}

      updateCounts(pageInfo['ref']);
      if(pageInfo['notify']){ displayNotification(pageInfo['notify']); }
      
      navBarInit();
      pageInit();
      widgetInit();
      effects();
    }
    
    
    function histUpdate(history_on){
      var uhc = $jq("#user_history-content");
      
      ajaxGet($jq(".user-history"), "/rest/history?sidebar=1");
      if(uhc.size()>0 && uhc.text().length > 4) ajaxGet(uhc, "/rest/history");
      if(history_on){
        setTimeout(histUpdate, 6e5); //update the history every 10min
      }
      return;
    }
   

    function navBarInit(){
      searchInit();
      $jq("#nav-bar").find("ul li").hover(function () {
          $jq("div.columns>ul").hide();
          if(timer){
            $jq(this).siblings("li").children("ul.dropdown").hide();
            $jq(this).siblings("li").children("a").removeClass("hover");
            $jq(this).children("ul.dropdown").find("a").removeClass("hover");
            $jq(this).children("ul.dropdown").find("ul.dropdown").hide();
            clearTimeout(timer);
            timer = undefined;
          }
          $jq(this).children("ul.dropdown").show();
          $jq(this).children("a").addClass("hover");
        }, function () {
          var toHide = $jq(this);
          if(timer){
            clearTimeout(timer);
            timer = undefined;
          }
          timer = setTimeout(function() {
                toHide.children("ul.dropdown").hide();
                toHide.children("a").removeClass("hover");
              }, 300)
        });
        ajaxGet($jq(".status-bar"), "/rest/auth", undefined, function(){
          $jq("#bench-status").load("/rest/workbench");
          var login = $jq("#login");
          if(login.size() > 0){
            login.click(function(){
              $jq(this).siblings().toggle();
              $jq(this).toggleClass("open ui-corner-top");
            });
          }else{
            $jq("#logout").click(function(){
              window.open('/logout','pop','status=no,resizable=yes,height=2px,width=2px').blur();
            });
          }
        });
    }
    
    function pageInit(){
      var personSearch = $jq("#person-search"),
          colDropdown = $jq("#column-dropdown");
      
      operator();
      $jq("#print").click(function() {
        var layout = location.hash.replace('#',''),
            print = $jq(this);
          $jq.ajax({
              type: "POST",
              url : '/rest/print',
              data: {layout:layout}, 
              beforeSend:function(){
                setLoading(print); 
              },
              success: function(data){
                print.html('');
                location.href=data;
              },
              error: function(request,status,error) {
                alert(request + " " + status + " " + error );
              }
            });
      });
   
      $jq(".section-button").click(function() {
          var section = $jq(this).attr('wname');
          $jq("#nav-" + section).trigger("open");
          Scrolling.goToAnchor(section);
      });

      if($jq(".sortable").size()>0){
        $jq(".sortable").sortable({
          handle: '.widget-header, #widget-footer',
          items:'li.widget',
          placeholder: 'placeholder',
          connectWith: '.sortable',
          opacity: 0.6,
          forcePlaceholderSize: true,
          update: function(event, ui) { updateLayout(); },
        });
      }
      
      
      colDropdown.find("a, div.columns div.ui-icon, div.columns>ul>li>a").click(function() {
        $jq("div.columns>ul").toggle();
      });
      
      colDropdown.children("ul").children("li").hover(
        function(){
          $jq(this).children("ul").show();
        },
        function(){
          var layout = $jq(this).children("ul");
          setTimeout(function(){layout.hide();}, 500);
        });
      
      $jq("#nav-min").click(function() {
        var nav = $jq(".navigation-min").add("#navigation"),
            ptitle = $jq("#page-title"),
            w = nav.width(),
            msg = "open sidebar",
            marginLeft = '-1em';
        if(w == 0){ w = '12em'; msg = "close sidebar"; marginLeft = 175; }else { w = 0;}
        nav.animate({width: w}).show();
        ptitle.animate({marginLeft: marginLeft}).show();
        nav.children("#title").children("div").toggle();
        $jq(this).attr("title", msg);
        $jq(this).children("#nav-min-icon").toggleClass("ui-icon-triangle-1-w").toggleClass("ui-icon-triangle-1-e");
      });
      
      // Should be a user supplied site-wide option for this.
      // which can be over-ridden on any widget.
      // Toggle should empty look of button
      $jq("#hide-empty-fields").click(function() {       
            $jq(".disabled" ).toggle();    
            $jq(this).toggleClass('ui-state-highlight');
      });
      if(personSearch.size()>0){
          ajaxGet(personSearch, personSearch.attr("href"), undefined, function(){
            personSearch.delegate(".results-person .result li a", 'click', function(){
                $jq(".ui-state-highlight").removeClass("ui-state-highlight");
                var wbid = $jq(this).attr("href").split('/').pop();
                $jq.ajax({
                    type: "GET",
                    url: "/auth/info/" + wbid,
                    dataType: 'json',
                    success: function(data){
                          var linkAccount = $jq("#link-account");
                          if(linkAccount.size()==0){
                            $jq("input#name").attr("value", data.fullname).attr("disabled", "disabled");
                            var email = new String(data.email);
                            if(data.email && data.status_ok){
                              var re = new RegExp($jq("input#email").attr("value"),"gi");
                              if (((email.match(re))) || !($jq("input#email").attr("value"))){
                                $jq("#email").attr("disabled", "disabled").parent().hide(); 
                              }
                              $jq("input#wbemail").attr("value", email).parent().show();
                            }else{
                              $jq("input#wbemail").attr("value", "").parent().hide();
                              $jq("#email").removeAttr("disabled").parent().show(); 
                            }
                            $jq(".register-notice").html("<span id='fade'>" +  data.message + "</span>").show();
                            $jq("input#wbid").attr("value", data.wbid);
                          }else{
                            $jq("input#wbid").attr("value", data.wbid);
                            $jq("input#email").attr("value", data.email);
                            linkAccount.removeAttr("disabled");
                            $jq("input#confirm").attr("value", "");
                            var emails = ["[% emails.join('", "') %]"];
                            if(data.email && data.status_ok){
                              var e = "" + data.email;
                              for(var i=0; i<emails.length; i++){
                                var re = new RegExp(emails[i],"gi");
                                if (e.match(re)){
                                  $jq(".register-notice").css("visibility", "hidden");
                                  $jq("input#confirm").attr("value", 1);
                                  return;
                                }
                              }
                            }else{
                              linkAccount.attr("disabled", 1);
                            }
                            $jq(".register-notice").html("<span id='fade'>" +  data.message + "</span>").css("visibility", "visible");

                          }
                      },
                    error: function(request,status,error) {
                        alert(request + " " + status + " " + error );
                      }
                });
                $jq(this).parent().parent().addClass("ui-state-highlight");
                return false;
            });
          });
      }
    }
    
    
    
    
    function widgetInit(){
      var widgetHolder = $jq("#widget-holder"),
          widgets = $jq("#widgets"),
          listLayouts = $jq(".list-layouts"),
          layout;
      if(widgetHolder.size()==0){return;}
      
      window.onhashchange = readHash;
      window.onresize = Layout.resize;
      if(location.hash.length > 0){
        readHash();
      }else if(layout = widgetHolder.data("layout")){
        resetPageLayout(layout);
      }else{
        openAllWidgets(true);
      }
      
      if(listLayouts.size()>0){ajaxGet(listLayouts, "/rest/layout_list/" + listLayouts.attr("type"));}
      
      // used in sidebar view, to open and close widgets when selected
      widgets.find(".module-load, .module-close").click(function() {
        var widget_name = $jq(this).attr("wname"),
            nav = $jq("#nav-" + widget_name),
            content = $jq("#" + widget_name + "-content");
        if(!nav.hasClass('ui-selected')){
          if(content.text().length < 4){
              var column = ".left",
                  lWidth = getLeftWidth(widgetHolder);
              if(lWidth >= 90){
                if(widgetHolder.children(".right").children(".visible").height()){
                  column = ".right";
                }
              }else{
                var leftHeight = height(widgetHolder.children(".left").children(".visible"));
                    rightHeight = height(widgetHolder.children(".right").children(".visible"));
                if (rightHeight < leftHeight){ column = ".right"; }
              }
              openWidget(widget_name, nav, content, column);
          }else{
            content.parents("li").addClass("visible");
            nav.addClass("ui-selected");
            moduleMin(content.prev().find(".module-min"), false, "maximize");
          }
          Scrolling.goToAnchor(widget_name);
          updateLayout();
        } else {
          Scrolling.scrollUp(content.parents("li"));
          moduleMin(content.prev().find(".module-min"), false, "minimize", function(){
            nav.removeClass("ui-selected");
            content.parents("li").removeClass("visible"); 
            updateLayout();
          });
        }
        Scrolling.sidebarMove();
        return false;
      });
      
      
      function height(list){
        var len = 0; 
        for(var i=-1, l = list.length; i++<l;){ 
          len += list.eq(i).height();
        } 
        return len;
      }
      


      
     
      Scrolling.sidebarInit();
      
      widgetHolder.children("#widget-header").disableSelection();

      widgetHolder.find(".module-max").click(function() {
        var module = $jq(this).parents(".widget-container"),
    //     if(module.find(".cboxElement").trigger('click').size() < 1){
            clone = module.clone(),
    //       clone.find(".module-max").remove();
    //       clone.find(".module-close").remove();
    //       clone.find(".module-min").remove();
    //       clone.find("#widget-footer").remove();
    //       clone.find("h3").children(".ui-icon").remove();
    //       clone.css("min-width", "400px");
    //       var cbox = $jq('<a class="cboxElement" href="#"></a>');
    //       cbox.appendTo(module).hide();
    //       cbox.colorbox({html:clone, title:"Note: not all effects are supported while widget is maximized", maxWidth:"100%"}).trigger('click');
    //     }

    // code for external pop out window - if we need that
          popout = window.open("", "test", "height=" + module.height() + ",width=" + module.width());
        popout.document.write(document.head.innerHTML);
        popout.document.write(clone.html());
      });

      // used in sidebar view, to open and close widgets when selected
      widgets.find(".module-load, .module-close").bind('open',function() {
        var widget_name = $jq(this).attr("wname"),
            nav = $jq("#nav-" + widget_name),
            content = $jq("#" + widget_name + "-content");

        openWidget(widget_name, nav, content, ".left");
        return false;
      });
      
      widgetHolder.find(".module-min").click(function() {
        moduleMin($jq(this), true);
      });
      
      

      widgetHolder.find(".reload").click(function() {
        reloadWidget($jq(this).attr("wname"));
      });
      
      $jq(".feed").click(function() {
        var url=$jq(this).attr("rel"),
            div=$jq(this).parent().next("#widget-feed");
        div.filter(":hidden").empty().load(url);
        div.slideToggle('fast');
      });
    }
    
    function effects(){
      var content = $jq("#content");
      $jq("body").delegate(".toggle", 'click', function(){
            $jq(this).toggleClass("active").next().slideToggle("fast", function(){
            if($jq.colorbox){ $jq.colorbox.resize(); }
            });
            return false;
      });
        
      content.delegate(".tooltip", 'mouseover', function(){
          var tip = $jq(this);
          getCluetip(function(){
            tip.cluetip({
              activation: 'click',
              sticky: true, 
              cluetipClass: 'jtip',
              dropShadow: false, 
              closePosition: 'title',
              arrows: true, 
              hoverIntent: false,
              });
            });
      });
      content.delegate(".text-min", 'click', function(){
        var container = $jq(this),
            txt = container.children(".text-min-expand"),
            more = txt.next(),
            h = (txt.height() < 40) ? '100%' : '2.4em';
        txt.animate({height:h}).css("max-height", "none");
        more.toggleClass('open').children().toggleClass('ui-icon-triangle-1-s ui-icon-triangle-1-n');
        container.parent().find(".expand").toggleClass('ellipsis');
      });
      
      content.delegate(".tip-simple", 'mouseover', function(){ 
        if(!($jq(this).children("div.tip-elem").show().children('span:not(".ui-icon")').text($jq(this).attr("tip")).size())){
          var tip = $jq('<div class="tip-elem tip ui-corner-all" style="display:block"><span>' + $jq(this).attr("tip") + '</span><span class="tip-elem ui-icon ui-icon-triangle-1-s"></span></div>');
          tip.appendTo($jq(this)).show();
        }
      });
      content.delegate(".tip-simple", 'mouseout', function(){ 
        $jq(this).children("div.tip-elem").hide();
      });
      
      content.delegate(".slink", 'mouseover', function(){
          var slink = $jq(this);
          getColorbox(function(){
            slink.colorbox({data: slink.attr("href"), 
                            width: "750px", 
                            height: "550px",
                            title: function(){ return slink.prev().text() + " sequence"; }});
          });
      });
      
      content.delegate(".bench-update", 'click', function(){
        var update = $jq(this),
            wbid = update.attr("wbid"),
            save_to = update.attr("save_to"),
            url = update.attr("ref") + '?name=' + escape(update.attr("name")) + "&url=" + escape(update.attr("href")) + "&save_to=" + save_to + "&is_obj=" + update.attr("is_obj");
        $jq(".star-status-" + wbid).find("#save").toggleClass("ui-icon-star-yellow ui-icon-star-gray");
        $jq("#bench-status").load(url, function(){
          if($jq("div#" + save_to + "-content").text().length > 3){ 
            reloadWidget(save_to, 1);
          }
        });
        return false;
      });
    }
    
    function moduleMin(button, hover, direction, callback) {
      var module = $jq("#" + button.attr("wname") + "-content");
      if (direction && (button.attr("title") != direction) ){ if(callback){ callback()} return; }
      module.slideToggle("fast", function(){Scrolling.sidebarMove(); if(callback){ callback()}});
      button.toggleClass("ui-icon-triangle-1-s ui-icon-triangle-1-e").parent().toggleClass("minimized");
      if(hover){ 
        module.next().slideToggle("fast"); 
        button.toggleClass("ui-icon-circle-triangle-e ui-icon-circle-triangle-s");
      }
      (button.attr("title") != "maximize") ? button.attr("show", 1).attr("title", "maximize") : button.attr("show", 0).attr("title", "minimize");
    }
    

    function displayNotification (message){
        if(notifyTimer){
          clearTimeout(notifyTimer);
          notifyTimer = undefined;
        }
        var notification = $jq("#notifications");
        notification.show().children("#notification-text").text(message);

        notifyTimer = setTimeout(function() {
              notification.fadeOut(400);
            }, 3e3)
    }
    $jq("#notifications").click(function() {
      if(notifyTimer){
        clearTimeout(notifyTimer);
        notifyTimer = undefined;
      }
      $jq(this).hide();
    });
    
    
       
   function systemMessage(action, messageId){
     var systemMessage = $jq(".system-message");
    if(action == 'show'){
      systemMessage.show().css("display", "block").animate({height:"20px"}, 'slow');
      $jq("#notifications").css("top", "20px");
      Scrolling.set_system_message(20); 
    }else{
      systemMessage.animate({height:"0px"}, 'slow', undefined,function(){ $jq(this).hide();});
      $jq.post("/rest/system_message/" + messageId);
      Scrolling.set_system_message(0); 
      $jq("#notifications").css("top", "0");
    }
  }


    function setLoading(panel) {
      panel.html('<div class="loading"><img src="/img/ajax-loader.gif" alt="Loading..." /></div>');
    }

    function ajaxGet(ajaxPanel, $url, noLoadImg, callback) {
      $jq.ajax({
        url: $url,
        beforeSend:function(){
          if(!noLoadImg){ setLoading(ajaxPanel); }
        },
        success:function(data){
          ajaxPanel.html(data);
        },
        error:function(xhr, ajaxOptions, thrownError){
          var error = $jq(xhr.responseText);
          ajaxPanel.html('<p class="error"><strong>Oops!</strong> Try that again in a few moments.</p>');
          ajaxPanel.append(error.find(".error-message-technical").html());
        },
        complete:function(XMLHttpRequest, textStatus){
          if(callback){ callback(); }
        }
      });
    }
    
      function operator(){
        var opTimer,
            opLoaded = false;
        $jq('#operator-box').click(function(){ 
          var opBox = $jq(this);
          if(!(opLoaded)){
            ajaxGet($jq("#operator-box"), "/rest/livechat", 0, 
                    function(){ 
                      if($jq("#operator-box").hasClass("minimize")){
                        $jq("#operator-box").children().hide();
                      }
                    });
            opLoaded = true;
          }
          if(opBox.hasClass("minimize")){
              opBox.removeClass("minimize");
              opBox.animate({width:"9em"});
              opBox.children().show();
          }else{
            opBox.addClass("minimize");
            opBox.animate({width:"1.5em"});
            opBox.children().hide();
          }
        });
        
        $jq('#operator').click(function() { 
          if($jq(this).attr("rel")) {
            $jq.post("/rest/livechat?open=1",function() {
              location.href="/tools/operator";
            });
          }else {
            var opBox = $jq("#operator-box");
            ajaxGet(opBox, "/rest/livechat", 0, 
            function(){ 
              if(opBox.hasClass("minimize")){
                opBox.children().hide();
              }
            });
            opLoaded = true;
            if(opBox.hasClass("minimize")){
                opBox.removeClass("minimize");
                opBox.animate({width:"9em"});
                opBox.children().show();
            }
            opTimer = setTimeout(function() {
              opBox.addClass("minimize");
              opBox.animate({width:"1.5em"});
              opBox.children().hide();
            }, 4e3)
          }
        }); 
    }
    
  function hideTextOnFocus(selector){
    var area = $jq(selector);
      
    if(area.attr("value") != ""){
      area.siblings().fadeOut();
    }
    area.focus(function(){
      $jq(this).siblings().fadeOut();
    });

    area.blur(function(){
      if($jq(this).attr("value") == ""){
        $jq(this).siblings().fadeIn();
      }
    });
  }











    /***************************/
    // Search Bar functions
    // author: Abigail Cabunoc
    // abigail.cabunoc@oicr.on.ca      
    /***************************/

    //The search bar methods
    function searchInit(){
      var searchBox = $jq("#Search"),
          searchBoxDefault = "search...",
          searchForm = $jq("#searchForm"),
          lastXhr;

      searchBox.focus(function(e){
        $jq(this).addClass("active");
      });
      searchBox.blur(function(e){
        $jq(this).removeClass("active");
      });

      //show/hide default text if needed
      searchBox.focus(function(){
        if($jq(this).attr("value") == searchBoxDefault) $jq(this).attr("value", "");
      });
      searchBox.blur(function(){
        if($jq(this).attr("value") == "") $jq(this).attr("value", searchBoxDefault);
      });
      
      searchBox.autocomplete({
          source: function( request, response ) {
              lastXhr = $jq.getJSON( "/search/autocomplete/" + cur_search_type, request, function( data, status, xhr ) {
                  if ( xhr === lastXhr ) {
                      response( data );
                  }
              });
          },
          minLength: 2,
          select: function( event, ui ) {
              location.href = ui.item.url;
          }
      });
      
    
    }


    
    function search(box) {
        if(!box){ box = "Search"; }else{ cur_search_type = 'all'; } 
        var f = $jq("#" + box).attr("value");
        if(f == "search..." || !f){
          f = "*";
        }

        f = encodeURIComponent(f.trim());
        f = f.replace('%26', '&');
        f = f.replace('%2F', '/');

        location.href = '/search/' + cur_search_type + '/' + f;
    }

    function search_change(new_search, focus) {
      if((!new_search) || (new_search == "home") || (new_search == "me") || (new_search == "bench")){ new_search = "gene"; }
      cur_search_type = new_search;
      if(new_search == "all"){
      new_search = "for anything";
      }else{
        var search_for = "for a";
        if(new_search.match(/^[aeiou]/)){
          search_for = search_for + "n";
        }
        new_search = search_for + " " + new_search.replace(/[_]/, ' ');
      }
      
      $jq("#current-search").text(new_search);
    }



  function checkSearch(div){
    var results = div.find("#results"),
        searchData = (results.size() > 0) ? results.data("search") : undefined;
    if(!searchData){ return; }
    SearchResult(searchData['query'], searchData["type"], searchData["species"], searchData["widget"], searchData["nostar"], searchData["count"], div);  
  }

  function SearchResult(q, type, species, widget, nostar, t, container){
    var query = decodeURI(q),
        page = 1.0,
        total = t,
        countSpan = container.find("#count"),
        resultDiv = container.find((widget ? "." + widget + "-widget " : '') + ".load-results"),
        queryList = query ? query.replace(/[,\.\*]/, ' ').split(' ') : [];

    function init(){
      container.find("#results").find(".load-star").each(function(){
        $jq(this).load($jq(this).attr("href"));
      });
    }
    
    
    function formatResults(div){
      var expands = div.find(".text-min");
      for(var i=-1, el, l = expands.size(); ((el = expands.eq(++i)) && i < l);){
        (el.height() > 35) ? 
          el.html('<div class="text-min-expand">' + el.text() + '</div><div class="more"><div class="ui-icon ui-icon-triangle-1-s"></div></div>')
          : el.removeClass("text-min");
      }

      if(queryList.length == 0) { return; }
      getHighlight(function(){
        for (var i=0; i<queryList.length; i++){
          if(queryList[i]) { div.highlight(queryList[i]); }
        }
      });
    }
    
    formatResults(container.find("div#results"));
    init();
    
    if(total > 10){
      if(container.find(".lazyload-widget").size() > 0){ Scrolling.search(); }
      resultDiv.click(function(){
        var url = $jq(this).attr("href") + (page + 1) + "?" + (species ? "species=" + species : '') + (widget ? "&widget=" + widget : '') + (nostar ? "&nostar=" + nostar : '');
            div = $jq("<div></div>"),
            res = $jq((widget ? "." + widget + "-widget" : '') + " #load-results");

        $jq(this).removeClass("load-results");
        page++;
        
        setLoading(div);
        
        res.html("loading...");
        div.load(url, function(response, status, xhr) {
          total = div.find("#page-count").data("count") || total;
          var left = total - (page*10);
          if(left > 0){
            if(left>10){left=10;}
            res.addClass("load-results");
            res.html("load " + left + " more results");
          }else{
            res.remove();
          }

          formatResults(div);

          if (status == "error") {
            var msg = "Sorry but there was an error: ";
            $jq(this).html(msg + xhr.status + " " + xhr.statusText);
          }
          Scrolling.sidebarMove();
          
          div.find(".load-star").each(function(){
            $jq(this).load($jq(this).attr("href"));
          });

          countSpan.html(total);
        });

        div.appendTo($jq(this).parent().children("ul"));
        loadcount++;
        Scrolling.sidebarMove();
      });
    }
    
  } //end SearchResult

  function loadResults(url){
    var allSearch = $jq("#all-search-results");
    allSearch.empty(); 
    ajaxGet(allSearch, url, undefined, function(){
      checkSearch(allSearch);
    });
    loadcount = 0;
    if(!allSearch.hasClass("references"))
      scrollToTop();
    return false;
  }
  
  function scrollToTop(){
    $jq(window).scrollTop(0);
    Scrolling.resetSidebar();
    return undefined;
  }
  
  function allResults(type, species, query){
    var url = "/search/" + type + "/" + query + "/?inline=1",
        allSearch = $jq("#all-search-results");
    allSearch.empty(); 
    if(species) { url = url + "&species=" + species;} 
    ajaxGet(allSearch, url, undefined, function(){
      checkSearch(allSearch);
    });

    $jq("#search-count-summary").find(".count").each(function() {
      $jq(this).load($jq(this).attr("href"), function(){
        if($jq(this).text() == '0'){
          $jq(this).parent().remove();
        }else {
          $jq(this).parent().show().parent().prev(".title").show();
        }
      });
    });
    
    $jq("#search-count-summary").find(".load-results").click(function(){
      var button = $jq(this);
      loadResults(button.attr("href"));
      button.addClass("ui-selected").siblings().removeClass("ui-selected").parent().siblings().find(".ui-selected").removeClass("ui-selected");
      $jq("#curr-ref-text").html(button.html());
      return false;
    });
    
    if (type == 'paper')
      Layout.resize();
    
  }


  function recordOutboundLink(link, category, action) {
    try {
      var pageTracker=_gat._createTracker("UA-16257183-1");
      pageTracker._trackEvent(category, action);
    }catch(err){}
  }

   
    function openWidget(widget_name, nav, content, column){
        var url     = nav.attr("href");
            
        content.closest("li").appendTo($jq("#widget-holder").children(column));

        if(content.text().length < 4){
          addWidgetEffects(content.parent(".widget-container"));
          ajaxGet(content, url, undefined, function(){ 
            Scrolling.sidebarMove();checkSearch(content);
          });
        }
        moduleMin(content.prev().find(".module-min"), false, "maximize");
        nav.addClass("ui-selected");
        content.parents("li").addClass("visible");
        return false;
    }
    
    function reloadWidget(widget_name, noLoad){
        var con = $jq("div#" + widget_name + "-content");
        ajaxGet(con, $jq("#nav-" + widget_name).attr("href"), noLoad, function(){ checkSearch(con); });
    }
    
      
  function addWidgetEffects(widget_container, callback) {
//       widget_container.find("div.module-min").addClass("ui-icon-large ui-icon-triangle-1-s").attr("title", "minimize");
//       widget_container.find("div.module-close").addClass("ui-icon ui-icon-large ui-icon-close").hide();
//       widget_container.find("div.module-max").addClass("ui-icon ui-icon-extlink").hide();
//       widget_container.find("#widget-footer").hide();
//       widget_container.find(".widget-header").children("h3").children("span.hide").hide();
  
      widget_container.find(".widget-header").hover(
        function () {
          $jq(this).children("h3").children("span").show();
        },
        function () {
          $jq(this).children("h3").children("span.hide").hide();
        }
      );

      widget_container.hover(
        function () {
          $jq(this).find(".widget-header").children(".ui-icon").show();
          if($jq(this).find(".widget-header").children("h3").children(".module-min").attr("show") != 1){
            $jq(this).find("#widget-footer").show();
          }
        }, 
        function () {
          $jq(this).find(".widget-header").children(".ui-icon").hide();
          $jq(this).find("#widget-footer").hide();
        }
      );

      widget_container.find("div.module-min").hover(
        function () {
          if ($jq(this).attr("show")!=1){ $jq(this).addClass("ui-icon-circle-triangle-s");
          }else{ $jq(this).addClass("ui-icon-circle-triangle-e");}
        }, 
        function () {
          $jq(this).removeClass("ui-icon-circle-triangle-s").removeClass("ui-icon-circle-triangle-e");
          if ($jq(this).attr("show")!=1){ $jq(this).addClass("ui-icon-triangle-1-s");
          }else{ $jq(this).addClass("ui-icon-triangle-1-e");}
        }
      );

      widget_container.find("div.module-close").hover(
        function () {
          $jq(this).addClass("ui-icon-circle-close");
        }, 
        function () {
          $jq(this).removeClass("ui-icon-circle-close").addClass("ui-icon-close");
        }
      );
  }












/***************************/
// layout functions   
/***************************/

//The layout methods
    
    function columns(leftWidth, rightWidth, noUpdate){
      var sortable = $jq("#widget-holder").children(".sortable"),
          tWidth = $jq("#widget-holder").innerWidth(),
          leftWidth = Layout.suppressColumns() ? 100 : leftWidth;
      if(leftWidth>95){
        sortable.removeClass('table-columns').addClass('one-column');
        rightWidth = leftWidth = 100;
      }else{
        sortable.addClass('table-columns').removeClass('one-column');
      }
      sortable.filter(".left").css("width",leftWidth + "%");
      sortable.filter(".right").css("width",rightWidth + "%");

      if(!noUpdate){ updateLayout(); }
    }

    function deleteLayout(layout){
      var $class = $jq("#widget-holder").attr("wclass");
      $jq.get("/rest/layout/" + $class + "/" + layout + "?delete=1");
      $jq("div.columns ul div li#layout-" + layout).remove();
    }

    function setLayout(layout){
      var $class = $jq("#widget-holder").attr("wclass");
      $jq.get("/rest/layout/" + $class + "/" + layout, function(data) {
          var nodeList = data.childNodes[0].childNodes,
              len = nodeList.length;
          for(i=0; i<len; i++){
            var node = nodeList.item(i);
            if(node.nodeName == "data"){
              location.hash = node.attributes.getNamedItem('lstring').nodeValue;
            }
          }
        }, "xml");
    }
    
    function resetPageLayout(layout){
      layout = layout || $jq("#widget-holder").data("layout");
      if(layout['hash']){
          location.hash = layout['hash'];
      }else{
          resetLayout(layout['leftlist'], layout['rightlist'] || [], layout['leftwidth'] || 100);
          reloadLayout++;
          updateLayout();
      }
    }
    

    

    


    function newLayout(layout){
      updateLayout(layout, undefined, function() {
        $jq(".list-layouts").load("/rest/layout_list/" + $jq(".list-layouts").attr("type"), function(response, status, xhr) {
            if (status == "error") {
                var msg = "Sorry but there was an error: ";
                $jq(".list-layouts").html(msg + xhr.status + " " + xhr.statusText);
              }
            });
          });
      return false;
    }
    
    function updateURLHash (left, right, leftWidth) {
      var l = $jq.map(left, function(i) { return getWidgetID(i);}),
          r = $jq.map(right, function(i) { return getWidgetID(i);}),
          ret = l.join('') + "-" + r.join('') + "-" + (leftWidth/10);
      if(location.hash && decodeURI(location.hash).match(/^[#](.*)$/)[1] != ret){
        reloadLayout++;
      }
      location.hash = ret;
      return ret;
    }
    
    function readHash() {
      if(reloadLayout == 0){
        var hash = location.hash,
            h = decodeURI(hash).match(/^[#](.*)$/)[1].split('-');
        if(!h){ return; }
        
        var l = h[0],
            r = h[1],
            w = (h[2] * 10);
        
        if(l){ l = $jq.map(l.split(''), function(i) { return getWidgetName(i);}); }
        if(r){ r = $jq.map(r.split(''), function(i) { return getWidgetName(i);}); }
        resetLayout(l,r,w,hash);
      }else{
        reloadLayout--;
      }
    }
    
    //get an ordered list of all the widgets as they appear in the sidebar.
    //only generate once, save for future
    var widgetList = this.wl || (function() {
        var instance = this,
            navigation = $jq("#navigation"),
            list = navigation.find(".module-load")
                  .map(function() { return this.getAttribute("wname");})
                  .get();
        this.wl = { list: list };
        return this.wl;
        })();
    
    //returns order of widget in widget list in radix (base 36) 0-9a-z
    function getWidgetID (widget_name) {
        return widgetList.list.indexOf(widget_name).toString(36);
    }
   
    function openAllWidgets(noTools){
      var hash = "",
          tools = noTools ? $jq("#navigation").find(".tools").size() : 0;
      if(widgetList.list.length == 0){ return; }
      for(i=0; i<(widgetList.list.length - 3 - tools); i++){
        hash = hash + (i.toString(36));
      }
      window.location.hash = hash + "--10";
      return false;
    }
    
    //returns widget name 
    function getWidgetName (widget_id) {
        return widgetList.list[parseInt(widget_id,36)];
    }

    function updateLayout(layout, hash, callback){
      var holder =  $jq("#widget-holder"),
          $class = holder.attr("wclass"),
          lstring = hash || readLayout(holder),
          l = ((typeof layout) == 'string') ? escape(layout) : 'default';
      $jq.post("/rest/layout/" + $class + "/" + l, { 'lstring':lstring }, function(){
      Layout.resize();
      if(callback){ callback(); }
      });
    }
    
    function readLayout(holder){
      var left = holder.children(".left").children(".visible")
                      .map(function() { return this.id;})
                      .get(),
          right = holder.children(".right").children(".visible")
                      .map(function() { return this.id;})
                      .get(),
          leftWidth = getLeftWidth(holder);
      return updateURLHash(left, right, leftWidth);
    }

    function getLeftWidth(holder){
      var leftWidth = Layout.suppressColumns() ?  ((decodeURI(location.hash).match(/^[#](.*)$/)[1].split('-')[2]) * 10): (parseFloat(holder.children(".left").outerWidth())/(parseFloat(holder.outerWidth())))*100;
      return Math.round(leftWidth/10) * 10; //if you don't round, the slightest change causes an update
    }

    function resetLayout(leftList, rightList, leftWidth, hash){
      $jq("#navigation").find(".ui-selected").removeClass("ui-selected");
      $jq("#widget-holder").children().children("li").removeClass("visible");

      columns(leftWidth, (100-leftWidth), 1);
      for(var widget = 0; widget < leftList.length; widget++){
        var widget_name = $jq.trim(leftList[widget]);
        if(widget_name.length > 0){
          var nav = $jq("#nav-" + widget_name),
              content = $jq("#" + widget_name + "-content");
          openWidget(widget_name, nav, content, ".left");
        }
      }
      for(var widget = 0; widget < rightList.length; widget++){
        var widget_name = $jq.trim(rightList[widget]);
        if(widget_name.length > 0){
          var nav = $jq("#nav-" + widget_name),
              content = $jq("#" + widget_name + "-content");
          openWidget(widget_name, nav, content, ".right");
        }
      }
      if(location.hash.length > 0){
        updateLayout(undefined, hash);
      }
    }
    
    
var Layout = (function(){
  var sColumns = false,
      ref = $jq("#references-content");
      
    function resize(){
      if(sColumns != (sColumns = (document.documentElement.clientWidth < 800)))
        sColumns ? columns(100, 100) : readHash();
      if(ref && (ref.hasClass("widget-narrow") != (ref.innerWidth() < 845)))
        ref.toggleClass("widget-narrow");
    }
    
    function suppressColumns(){
     return sColumns; 
    }
    
  return {
      suppressColumns: suppressColumns,
      resize: resize
  }
})();



var Scrolling = (function(){
  var $window = $jq(window),
      system_message = 0,
      static = 0,// 1 = sidebar fixed position top of page. 0 = sidebar in standard pos
      footerHeight = $jq("#footer").outerHeight(),
      sidebar,
      offset,
      widgetHolder,
      body = $jq('html,body'),
      scrollingDown = 0,
      count = 0, //semaphore
      titles;
                 
  function resetSidebar(){
    static = 0;
    $jq("#navigation").stop().css('position', 'relative').css('top', 0);
  }
  
  function goToAnchor(anchor){
      var elem = document.getElementById(anchor),
          scroll = isScrolledIntoView(elem) ? undefined : $jq(elem).offset().top - system_message - 10;
      if(scroll){
        body.stop().animate({
          scrollTop: scroll
        }, 2000, function(){ Scrolling.sidebarMove(); scrollingDown = 0;});
        scrollingDown = (body.scrollTop() < scroll) ? 1 : 0;
      }
  }
  
  function scrollUp(elem){
    var elemBottom = $jq(elem).offset().top + $jq(elem).height(),
        docViewBottom = $window.scrollTop() + $window.height();
    if((elemBottom <= docViewBottom) ){ 
      body.stop().animate({
          scrollTop: $window.scrollTop() - elem.height() - 10
      }, "fast", function(){ Scrolling.sidebarMove(); });
    }
  }
    
  function isScrolledIntoView(elem){
      var docViewTop = $window.scrollTop(),
          docViewBottom = docViewTop + ($window.height()*0.75),
          elemTop = $jq(elem).offset().top,
          elemBottom = elemTop + $jq(elem).height();
      return ((elemBottom >= docViewTop) && (elemTop <= docViewBottom));
  }
  
  function sidebarMove() {
      if(sidebar.offset()){
        var objSmallerThanWindow = sidebar.outerHeight() < ($window.height() - system_message),
            scrollTop = $window.scrollTop(),
            maxScroll = $jq(document).height() - (sidebar.outerHeight() + footerHeight + system_message + 20); //the 20 is for padding before footer

        if(sidebar.outerHeight() > widgetHolder.height()){
            resetSidebar();
            return;
        }
        if (objSmallerThanWindow){
          if(static==0){
            if ((scrollTop > offset) && (scrollTop < maxScroll)) {
                sidebar.stop().css('position', 'fixed').css('top', system_message);
                static++;
            }else if(scrollTop > maxScroll){
                sidebar.stop().css('position', 'fixed').css('top', system_message - (scrollTop - maxScroll));
            }
          }else{
            if (scrollTop < offset) {
                sidebar.stop().css('position', 'relative').css('top', 0);
                static--;
            }else if(scrollTop > maxScroll){
                sidebar.stop().css('top', system_message - (scrollTop - maxScroll));
                static--;
                if(scrollingDown == 1){body.stop(); scrollingDown = 0; }
            }
          }
        }else if(count==0 && (titles = sidebar.find(".ui-icon-triangle-1-s"))){ 
          //close lowest section. delay for animation. 
          count++; //Add counting semaphore to lock
          titles.last().parent().click().delay(250).queue(function(){ count--; Scrolling.sidebarMove();});
        }
      } 
    }
  
  function sidebarInit(){
    sidebar   = $jq("#navigation");
    offset = sidebar.offset().top;
    widgetHolder = $jq("#widget-holder");
        
    sidebar.find(".title").click(function(){
      $jq(this).children(".ui-icon").toggleClass("ui-icon-triangle-1-s").toggleClass("ui-icon-triangle-1-e");
    }); 
    
    $window.scroll(function() {
      Scrolling.sidebarMove();
    });
  }
  
  var search = function searchInit(){
      if(loadcount >= 6){ return; }
      $window.scroll(function() {
        var results    = $jq("#results");
        if(results.offset() && loadcount < 6){
          var rHeight = results.height() + results.offset().top;
          var rBottomPos = rHeight - ($window.height() + $window.scrollTop())
          if(rBottomPos < 400) {
            results.children(".load-results").trigger('click');
          }
        }
      });
    };
  
  function set_system_message(val){
    system_message = val;
  }
  
  return {
    sidebarInit:sidebarInit,
    search:search,
    set_system_message:set_system_message, 
    sidebarMove: sidebarMove,
    resetSidebar:resetSidebar,
    goToAnchor: goToAnchor,
    scrollUp: scrollUp
  }
})();

    if(!Array.indexOf){
        Array.prototype.indexOf = function(obj){
            for(var i=0; i<this.length; i++){
                if(this[i]==obj){
                    return i;
                }
            }
            return -1;
        }
    }
      
      
  function updateCounts(url){
    var comments = $jq(".comment-count");
    if(comments.size() == 0){ return; }
    
    comments.load("/rest/feed/comment?count=1;url=" + url);
    var is = $jq("<span></span>");
    is.load("/rest/feed/issue?count=1;url=" + url, function(){
      if(is.html() != "0"){
        $jq(".issue-count").html("!").css({color:"red"});
      } 
    });
  }
  
  
  
  function validate_fields(email,username, password, confirm_password, wbemail){
      if( (email.val() =="") && (!wbemail || wbemail.val() == "")){
                email.focus().addClass("ui-state-error");return false;
      } else if( email.val() && (validate_email(email.val(),"Not a valid email address!")==false)) {
                email.focus().addClass("ui-state-error");return false;
      } else if(password) {
          if( password.val() ==""){
                password.focus().addClass("ui-state-error");return false;
          } else if( confirm_password && (password.val() != confirm_password.val())) {
              alert("The passwords do not match. Please enter again"); password.focus().addClass("ui-state-error");return false;
          }  
      } else if( username && username.val() =="") {
                username.focus().addClass("ui-state-error"); return false;
      }  else {
        return true;
      }
  }

  function validate_email(field,alerttxt){
    var apos=field.indexOf("@"),
        dotpos=field.lastIndexOf(".");
    if (apos<1||dotpos-apos<2)
      {alert(alerttxt);return false;}
    else {return true;}
  } 
  
  
  var comment = {
    init: function(pageInfo){
      comment.url = pageInfo['ref'];
    },
    submit: function(cm){
        var feed = cm.closest('#comment-new'),
            content = feed.find(".comment-content").val();
        if(content == "" || content == "write a comment..."){
            alert("Please provide your name & comment"); return false;
        }
        $jq.ajax({
          type: 'POST',
          url: '/rest/feed/comment',
          data: { content: content, url: comment.url},
          success: function(data){
            displayNotification("Comment Submitted!");
            feed.find("#comment-box").prepend(data);
            feed.find(".comment-content").val("write a comment...");
            updateCounts(url);
              },
          error: function(request,status,error) {
                alert(request + " " + status + " " + error);
              }
        });
        var box = $jq('<div class="comment-box"><a href="/me">' + name + '</a> ' + content + '<br /><span id="fade">just now</span></div>');
        var comments = $jq("#comments");
        comments.prepend(box);
        return false;
    },
    cmDelete: function(cm){
       var $id=cm.attr("id");
      var url= cm.attr("rel");
      
      $jq.ajax({
        type: "POST",
        url : url,
        data: {method:"delete",id:$id}, 
        success: function(data){
                      updateCounts(url);
          },
        error: function(request,status,error) {
            alert(request + " " + status + " " + error );
          }
      });
      cm.parent().remove(); 
    }
    
  }


  var issue = {
    init: function(pageInfo){
      issue.url = pageInfo['ref'];
    },
   submit:function(is){
        var rel= is.attr("rel"),
            url = is.attr("url"),
            page= is.attr("page"),
            feed = is.closest('#issues-new'),
            email = feed.find("#email"),
            username= feed.find("#display-name"),
            is_private = feed.find("#isprivate:checked").size();
        if(email.attr('id') && username.attr('id')) {
           if(validate_fields(email,username)==false) {return false;}
        }  
        $jq.ajax({
          type: 'POST',
          url: rel,
          data: {title:feed.find("#title").val(), 
                content: feed.find("#content").val(), 
                email:email.val() ,
                username:username.val() , 
                url:issue.url,
                isprivate:is_private},
          success: function(data){
                if(data==0) {
                   alert("The email address has already been registered! Please sign in."); 
                }else {
                  displayNotification("Problem Submitted! We will be in touch soon.");
                  feed.closest('#widget-feed').hide(); 
                              updateCounts(url);
                  reloadWidget('issue');
                }
              },
          error: function(request,status,error) {
                alert(request + " " + status + " " + error);
              }
        });

        return false;
   },
   isDelete: function(button){
      var url = button.attr("rel"),
          id = new Array();
      $jq(".issue-deletebox").filter(":checked").each(function(){
         id.push($jq(this).attr('name'));
      });
      var answer = confirm("Do you really want to delete these issues: #"+id.join(' #'));
      if(answer){
        $jq.ajax({
              type: "POST",
              url : url,
              data: {method:"delete",issues:id.join('_')}, 
              success: function(data){
                  window.location.reload(1);
                  updateCounts(url);
              },
              error: function(request,status,error) {
                  alert(request + " " + status + " " + error );
            }
          });
      } 
   },
   update: function(is, issue_id){
          var url= is.attr("rel"),
              thread = is.closest('#threads-new');
          $jq.ajax({
            type: 'POST',
            url: url,
            data: { content: $jq("textarea").val(),
                    issue:issue_id,
                    state:$jq("#issue_status option:selected").val(),
                    severity:$jq("#issue_severity option:selected").val(),
                    assigned_to:$jq("#issue_assigned_to option:selected").val()},
            success: function(data){
                      window.location.reload();  
                },
            error: function(request,status,error) {
    // I don't know why this always throws an error if everything goes well....
//                       alert(request + " " + status + " " + error);
                }
          });
        return false;
   }
  }


  var StaticWidgets = {
    update: function(widget_id, path){
        if(!widget_id){ widget_id = "0"; }
        var widget = $jq("li#static-widget-" + widget_id),
            widget_title = widget.find("input#widget_title").val(),
            widget_order = widget.find("input#widget-order").val(),
            widget_content = widget.find("textarea#widget_content").val();

        $jq.ajax({
              type: "POST",
              url: "/rest/widget/static/" + widget_id,
              dataType: 'json',
              data: {widget_title:widget_title, path:path, widget_content:widget_content, widget_order:widget_order},
              success: function(data){
                    StaticWidgets.reload(widget_id, 0, data.widget_id);
                },
              error: function(request,status,error) {
                  alert(request + " " + status + " " + error );
                }
          }); 
    },
    edit: function(wname, rev) {
      var widget_id = wname.split("-").pop(),
          w_content = $jq("#" + wname + "-content"),
          widget = w_content.parent(),
          edit_button = widget.find("a#edit-button");
      if(edit_button.hasClass("ui-state-highlight")){
        StaticWidgets.reload(widget_id);
      }else{
        edit_button.addClass("ui-state-highlight");
        w_content.load("/rest/widget/static/" + widget_id + "?edit=1");
      }

    },
    reload: function(widget_id, rev_id, content_id){
      var w_content = $jq("#static-widget-" + widget_id + "-content"),
          widget = w_content.parent(),
          title = widget.find("h3 span.widget-title input"),
          url = "/rest/widget/static/" + (content_id || widget_id);
      if(title.size()>0){
        title.parent().html(title.val());
      }
      widget.find("a.button").removeClass("ui-state-highlight");
      $jq("#nav-static-widget-" + widget_id).text(title.val());
      if(rev_id) { url = url + "?rev=" + rev_id; } 
      w_content.load(url);
    },
    delete_widget: function(widget_id){
      if(confirm("are you sure you want to delete this widget?")){
        $jq.ajax({
          type: "POST",
          url: "/rest/widget/static/" + widget_id + "?delete=1",
          success: function(data){
            $jq("#nav-static-widget-" + widget_id).click().hide();
          },
          error: function(request,status,error) {
            alert(request + " " + status + " " + error );
          }
        }); 
      }
    },
    history: function(wname){
      var widget = $jq("#" + wname),
         history = widget.find("div#" + wname + "-history");
      if(history.size() > 0){
        history.toggle();
        widget.find("a#history-button").toggleClass("ui-state-highlight");
      }else{
        var widget_id = wname.split("-").pop(),
            history = $jq('<div id="' + wname + '-history"></div>'); 
        history.load("rest/widget/static/" + widget_id + "?history=1");
        widget.find("div.content").append(history);
        widget.find("a#history-button").addClass("ui-state-highlight");
      }
    }
  }
  
  
  function historyOn(action, value, callback){
    if(action == 'get'){
        getColorbox(function(){
            $jq(".history-logging").colorbox();
            if(callback) callback();
        });
    }else{
      $jq.post("/rest/history", { 'history_on': value }, function(){ if(callback) callback(); });
      histUpdate(value == 1 ? 1 : undefined);
      if($jq.colorbox) $jq.colorbox.close();
    }
  }


  var Breadcrumbs = {
    init: function() {
      this.bc = $jq('#breadcrumbs');
      if (!this.bc) { return; };
      this.children = this.bc.children(),
      this.bCount = this.children.size();
      if(this.bCount < 3){ return; }; //less than three items, don't bother with breadcrumbs
      this.exp = false;
      this.bc.empty();
      var hidden = this.children.slice(0, (this.bCount - 2));
      var shown = this.children.slice((this.bCount - 2));
      this.hiddenContainer = $jq('<span id="breadcrumbs-hide"></span>');
      this.hiddenContainer.append(hidden).children().after(' &raquo; ');

      this.bc.append('<span id="breadcrumbs-expand" class="tip-simple ui-icon-large ui-icon-triangle-1-e " tip="exapand"></span>').append(this.hiddenContainer).append(shown);
      this.bc.children(':last').before(" &raquo; ");
    
      this.expand = $jq("#breadcrumbs-expand");
      
      this.expand.click( function(){
        if( Breadcrumbs.exp ){ Breadcrumbs.show(); }
        else{ Breadcrumbs.hide(); }
      });
      this.width = this.hiddenContainer.width();
      this.hide();
    },
    
    show: function(){
      Breadcrumbs.hiddenContainer.animate({width:Breadcrumbs.width}, function(){ Breadcrumbs.hiddenContainer.css("width", "auto");}).css("visibility", 'visible');
      Breadcrumbs.expand.attr("tip", "minimize");
      Breadcrumbs.expand.removeClass("ui-icon-triangle-1-e").addClass("ui-icon-triangle-1-w");
      Breadcrumbs.exp = false;
    },
    
    hide: function() {
      Breadcrumbs.hiddenContainer.animate({width:0}, function(){ Breadcrumbs.hiddenContainer.css("visibility", 'hidden');});     
      Breadcrumbs.expand.attr("tip", "expand");
      Breadcrumbs.expand.removeClass("ui-icon-triangle-1-w").addClass("ui-icon-triangle-1-e");
      Breadcrumbs.exp = true;
    }
  }



  var providers_large = {
      google: {
          name: 'Google',
          url: 'https://www.google.com/accounts/o8/id'
      },
      facebook: {
          name: 'Facebook',      
          url:  'http://facebook.anyopenid.com/'
      }
  };
  
  var providers = $jq.extend({}, providers_large);

  var openid = {
      signin: function(box_id, onload) {
        var provider = providers[box_id];
        if (! provider) {
            return;
        }
        var pop_url = '/auth/popup?id='+box_id + '&url=' + provider['url']  + '&redirect=' + location;
        this.popupWin(pop_url);
      },

      popupWin: function(url) {
        var h = 400;
        var w = 600;
        var screenx = (screen.width/2) - (w/2 );
        var screeny = (screen.height/2) - (h/2);
        
        var win2 = window.open(url,"popup","status=no,resizable=yes,height="+h+",width="+w+",left=" + screenx + ",top=" + screeny + ",toolbar=no,menubar=no,scrollbars=no,location=no,directories=no");
        win2.focus();
      }
  };
  
  

  function getScript(name, url, stylesheet, callback) {
    var head = document.documentElement,
        script = document.createElement("script"),
        done = false;
    loading = true;
    script.src = url;
    
    if(stylesheet){
     var link = document.createElement("link");
     link.href = stylesheet;
     link.rel="stylesheet";
     document.getElementsByTagName("head")[0].appendChild(link)
    }
    
    script.onload = script.onreadystatechange = function() {
     if(!done && (!this.readyState ||
       this.readyState === "loaded" || this.readyState === "complete")){
       done = true;
       loading = false;
       plugins[name] = true;
       callback();
     
        script.onload = script.onreadystatechange = null;
        if( head && script.parentNode){
          head.removeChild( script );
        }
      }
    };
    
    head.insertBefore( script, head.firstChild);
    return undefined;
  }
  

    function getDataTables(callback){
      getPlugin("dataTables", "/js/jquery/plugins/dataTables/media/js/jquery.dataTables.min.js", "/js/jquery/plugins/dataTables/media/css/demo_table.css", callback);
      return;
    }
    function getHighlight(callback){
      getPlugin("highlight", "/js/jquery/plugins/jquery.highlight-1.1.js", undefined, callback);
      return;
    }
    function getCluetip(callback){
      getPlugin("cluetip", "/js/jquery/plugins/cluetip-1.0.6/jquery.cluetip.min.js", "/js/jquery/plugins/cluetip-1.0.6/jquery.cluetip.css", callback);
      return;
    }
    function getMarkItUp(callback){
      getPlugin("markitup", "/js/jquery/plugins/markitup/jquery.markitup.js", "/js/jquery/plugins/markitup/skins/markitup/style.css", function(){
      getPlugin("markitup-wiki", "/js/jquery/plugins/markitup/sets/wiki/set.js", "/js/jquery/plugins/markitup/sets/wiki/style.css", callback);
      });
      return;
    }
    function getColorbox(callback){
      getPlugin("colorbox", "/js/jquery/plugins/colorbox/colorbox/jquery.colorbox-min.js", "/js/jquery/plugins/colorbox/colorbox/colorbox.css", callback);
      return;
    }
  
  
    function getPlugin(name, url, stylesheet, callback){
      if(!plugins[name]){
        getScript(name, url, stylesheet, callback);
      }else{
        if(loading){
          setTimeout(getPlugin(name, url, stylesheet, callback),1);
          return;
        }
        callback(); 
      }
      return;
    }
    
    return{
      init: init,
      ajaxGet: ajaxGet,
      hideTextOnFocus: hideTextOnFocus,
      goToAnchor: Scrolling.goToAnchor,
      setLoading: setLoading,
      resetLayout: resetLayout,
      openAllWidgets: openAllWidgets,
      displayNotification: displayNotification,
      deleteLayout: deleteLayout,
      columns: columns,
      setLayout: setLayout,
      resetPageLayout: resetPageLayout,
      search: search,
      search_change: search_change,
      openid: openid,
      validate_fields: validate_fields,
      StaticWidgets: StaticWidgets,
      recordOutboundLink: recordOutboundLink,
      comment: comment,
      issue: issue,
      getDataTables: getDataTables,
      getMarkItUp: getMarkItUp,
      getColorbox: getColorbox,
      checkSearch: checkSearch,
      scrollToTop: scrollToTop,
      historyOn: historyOn,
      allResults: allResults
    }
  })();




 $jq(document).ready(function() {
      $jq.ajaxSetup( {timeout: 12e4 }); //2 minute timeout on ajax requests
      WB.init();
 });

 window.WB = WB;
 window.$jq = $jq;
}(this,document);


if(typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, ''); 
  }
}