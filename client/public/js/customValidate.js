"use strict";$(document).ready(function(){$(".form-signin").validate({rules:{firstname:{required:!0},lastname:{required:!0},emailaddress:{required:!0,email:!0},password:{minlength:6,required:!0},confirmation:{minlength:6,equalTo:"#password"}},success:function(e){e.text("OK!").addClass("valid")}})});
//# sourceMappingURL=customValidate.js.map
