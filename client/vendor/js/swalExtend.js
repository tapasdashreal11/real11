    // Andrew Mestas 2016
    $('body').keypress(function(e){
      if(e.key === "Escape"){ //ESC key
        $(".swalExtendButton").remove();
      }
    });

    function swalExtend(params){
        params.classNames = params.classNames || [];
        params.swalFunctionParams = params.swalFunctionParams || [];

        if(params.swalFunction === undefined) {
          swal("swalExtend", "No sweetalert function specified.", "error");
          return;
        }
        if(params.buttonNum < 1){
          swal("swalExtend", "Need at least one more button. Got a number less than 1.", "error" );
          return;
        }
        if(params.buttonNames.length == 0){
           swal("swalExtend", "No button names specified.", "warning");
          return;
        }
        if(params.buttonNames.length != params.buttonNum){
           swal("swalExtend", "Number of buttons wanted does not match button names length.", "error");
          return;
        }
        if(params.classNames.length > params.buttonNames.length){
          swal("swalExtend", "Number of classNames in list is longer that intended buttons.", "error");
          return;
        }
        if(params.buttonColor === undefined){
          params.buttonColor = null;
        } 
        else if(typeof(params.buttonColor) === "object" && params.buttonColor.length) {
          if(params.buttonColor.length === params.buttonNum){
            this.buttonColorArray = true;
          } else {
            swal("swalExtend", "Number of button colors does not match button length.", "error");
            return;
          }
        } 
        else if(typeof(params.buttonColor) === "string"){
          this.buttonColorArray = false;
        }

        params.swalFunction.apply(this, params.swalFunctionParams);
        if(params.buttonNum > 0) {
          $('body').find('.sweet-alert').append('<a href="javascript:;" class="icon-remove" style="top: 5px; position: absolute; right: 10px; color: #d9534f;"><i class="fa fa-times"></i></a>');
          $('body').on('click', '.icon-remove', function() {
            $('body').find('.btn-close-sweet').remove();
            $('body').find('.icon-remove').remove();
            $(".swalExtendButton").remove();
            sweetAlert.close();
          })
        }

        $(".confirm, .sweet-overlay").on('click', function(){
          $('body').find('.btn-close-sweet').remove();
          $('body').find('.icon-remove').remove();
          $(".swalExtendButton").remove();
        })

        if(params.hasCancelButton){
          var container = document.querySelector(".sa-button-container");
          var cancel = document.querySelector(".cancel");
          var c = container.removeChild(cancel);
        }

        for(var i=0;i<params.buttonNum; i++){
         if(document.getElementsByClassName("confirm").length < params.buttonNum+1){
            var itm = document.getElementsByClassName("sa-confirm-button-container")[0];
            var cln = itm.cloneNode(true);
            document.getElementsByClassName("sa-button-container")[0].appendChild(cln);

            var t = document.getElementsByClassName("confirm")[i+1];
            var div = document.createElement("div");
            div.className = t.className;
            div.style.cssText = t.style.cssText;
            div.innerHTML = t.innerHTML;
            t.parentNode.replaceChild(div, t);
             
            if(div!= undefined){
              div.innerHTML = params.buttonNames[i] || div.innerHTML;
              var cl = div.className;
              var add = params.classNames[i] == undefined ? "" : params.classNames[i];
              div.className = params.classNames[i] == undefined ? cl + " divbutton " + add + " swalExtendButton" : "confirm " + add + " divbutton swalExtendButton";
              if(this.buttonColorArray){
                div.style.backgroundColor = params.buttonColor[i] ? params.buttonColor[i] : "#DD6B55";
              } 
              else {
                div.style.backgroundColor = params.buttonColor ? params.buttonColor : "#DD6B55";
              }
            }

            if(params.clickFunctionList[i]){
              div.addEventListener("click", params.clickFunctionList[i]);
              div.addEventListener("click", function(){
                $('body').find('.btn-close-sweet').remove();
                $('body').find('.icon-remove').remove();
                $(".swalExtendButton").remove();
                sweetAlert.close();
              })
            }
        }
        if(params.hasCancelButton){
          if(container.firstChild)container.insertBefore(c, container.firstChild);
          else container.appendChild(c);
        }
      };
      params.swalFunction.apply(this, params.swalFunctionParams);
      $(".swalExtendButton").show();
    };

