$(document).ready(function () {
    $('#email').on('keyup', function() {
        $('#error-email').html('');
    })
    $('#phone').on('keyup', function() {
        $('#error-phone').html('');
    })

    $("#form-registration" ).submit(function( event ) {
        const email = $.trim($('#email').val());
        const phone = $.trim($('#phone').val());
        let error = false;
        if(!email && !phone) {
            error = true;
            $('#email').focus();
        }
        if(email) {
            if(!validateEmail(email)) {
            error = true;
            $('#error-email').html('Invalid email address');
            }
        }
        if(phone) {
            if(!validatePhone(phone)) {
            error = true;
            $('#error-phone').html('Invalid phone number');
            }
        }
        if(error) {
            event.preventDefault();
        }
    });
    $('#code-confirm').on('keyup', function() {
        $('#alert-valid-code').hide().find('p').html('');
        const value = $(this).val();
        if(value && value.length === 4) {
            $('#btn-confirm').prop('disabled',  false);
        } else {
            $('#btn-confirm').prop('disabled',  true);
        }
    })

    $('#btn-confirm').on('click', function() {
        const phone = $('#phone-register').val();
        const userId = $('#id-register').val();
        const code = $('#code-confirm').val();
        const linkReset = $('#link-reset').val();
        $('#btn-confirm').prop('disabled', true);
        if(code && code.length === 4) {
            $.ajax({
                url: '/users/confirm/code',
                method: 'POST',
                dataType: 'json',
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify({ code: code, phone: phone, userId: userId }),
                success : function(data) {
                    if(data && data.success && data.link) {
                        if(linkReset) {
                            window.location.href = linkReset;
                        } else {
                            window.location.href = data.link; 
                        }
                    } else {
                        $('#alert-valid-code').show().find('p').html(data.message || 'Code not corret!');
                    }
                    $('#btn-confirm').prop('disabled', false);
                },
                error: function(error){
                    console.error(error)
                }
            })
        } else {
            $('#btn-confirm').prop('disabled', false);
            $('#alert-valid-code').show().find('p').html('Code not exists');
        }
    })

    $('#btn-send-to').on('click', function() {
        $('#btn-send-to').html('<i class="fa fa-spinner fa-spin fa-fw"></i>');
        $('#btn-send-to').prop('disabled', true);
        const linkReset = $('#link-reset').val() ? true : '';
        const phone = $('#phone-register').val();
        if(phone) {
            $.ajax({
                url: '/users/confirm/reset',
                method: 'POST',
                dataType: 'json',
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify({ phone: phone, registration: linkReset }),
                success : function(data) {
                    if(data && data.success) {
                        toastr.success(data.message);
                    } else {
                        toastr.error(data.message || `We cannot send sms to phone number ${phone}`);
                    }
                    $('#btn-send-to').html('send again');
                    $('#btn-send-to').prop('disabled', false);
                },
                error: function(error){
                    console.error(error)
                    $('#btn-send-to').html('send again');
                    $('#btn-send-to').prop('disabled', false);
                    toastr.error("We couldn't send to the server!");
                }
            })
        }
    })
})
function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

function validatePhone(phone) {
    let regexUSPhoneNumber = new RegExp(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im);
    return regexUSPhoneNumber.test(phone)
}