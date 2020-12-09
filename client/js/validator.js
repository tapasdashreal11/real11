
+function ($) {
  'use strict';
  // Number ==================
  $('.numberOnly').blur(function ($event) {
    let maxLength = $(this).data('maxlength');
    let min = $(this).data('min');
    let max = $(this).data('max');
    let aux = $event.target.value;

    maxLength = Number(maxLength);

    if (!isNaN(maxLength)) {
      aux = aux.substr(0, maxLength);
    }

    let value = Number(aux);
    if (isNaN(value)) value = 0;
    if(!isNaN(Number(min))) value = value < min ? Number(min) : value;
    if(!isNaN(Number(max))) value = value > max ? Number(max) : value;
    
    aux = value.toFixed(0);
    $event.target.value = aux;
  });
  // Float ========================
  $('.floatOnly').blur(function ($event) {
    let maxLength = $(this).data('maxlength');
    let min = $(this).data('min');
    let max = $(this).data('max');
    let aux = $event.target.value;

    maxLength = Number(maxLength);

    if (!isNaN(maxLength)) {
      aux = aux.substr(0, maxLength);
    }

    let value = Number(aux);
    if (isNaN(value)) value = 0;
    if(!isNaN(Number(min))) value = value < min ? Number(min) : value;
    if(!isNaN(Number(max))) value = value > max ? Number(max) : value;
    
    aux = value;
    $event.target.value = aux;
  });
  // Percent ==================
  $('.percentOnly').focus(function ($event) {
    let value = $event.target.value;
    value = value.replace(' %', '');
    value = value.replace(/\,/g, '');

    const [integer, mantissa] = value.split('.');
    let auxvalue
    if (parseInt(mantissa) > 0) {
      auxvalue = value;
    } else {
      auxvalue = integer;
    }
    $event.target.value = auxvalue;
    $event.target.select();
  });

  $('.percentOnly').blur(function ($event) {
    let maxLength = $(this).data('maxlength');
    let min = $(this).data('min');
    let max = $(this).data('max');
    let _decimalPlaces = 2;
    let aux = $event.target.value;
    aux = aux.replace(',', '.');
    aux = aux.replace('%', '');
    maxLength = Number(maxLength);
    if (!isNaN(maxLength)) {
      let [integer, mantissa] = aux.split('.');
      integer = integer.substr(0, maxLength);
      aux = mantissa ? integer + '.' + mantissa : integer;
    }
    let value = Number(aux);
    if (isNaN(value)) value = 0;
    if(!isNaN(Number(min))) value = value < min ? Number(min) : value;
    if(!isNaN(Number(max))) value = value > max ? Number(max) : value;

    aux = value.toFixed(_decimalPlaces);
    aux = aux.replace(',', '.');
    aux = aux.replace(/(\d)(?=(\d{3})+\.)/g, '$1,') + ' %';

    $event.target.value = aux;
  });
  // Currency ==================

  $.fn.currencyFormatter = function () {
    this.each(function (i, l) {
      var $l = $(l), currency;
      switch ($l.data("currency")) {
        default: currency = {
          symbol: "$",
          round: 2,
          decicmal: ".",
          thousands: ","
        }
          break;
      }
      $l.focus(function () {
        if ($l.val() == $l.attr("title")) {
          $l.val("");
        } else {
          let value = $l.val();
          value = convertToNumber(value)
          $l.val(value)
        }
      }).blur(function () {
        if ($l.val() == "$0.00" || $l.val() === "") {
          $l.val($l.attr("title"));
        } else {
          let min = $(this).data('min');
          let max = $(this).data('max');
          var n = $l.val().replace(/[^0-9\-\.]/g, "");
          n = Number(n);
          if (isNaN(n)) n = 0;
          if(!isNaN(Number(min))) n = n < min ? Number(min) : n;
          if(!isNaN(Number(max))) n = n > max ? Number(max) : n;
          var c = currency.round,
            d = currency.decicmal,
            t = currency.thousands,
            s = n < 0 ? "-" : "",
            q = n,
            i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "",
            j = (j = i.length) > 3 ? j % 3 : 0;
          $l.val(currency.symbol + s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : ""));
        }
      }).change(function () {
        let min = $(this).data('min');
        let max = $(this).data('max');
        var n = $l.val().replace(/[^0-9\-\.]/g, "");
        n = Number(n);
        if (isNaN(n)) n = 0;
        if(!isNaN(Number(min))) n = n < min ? Number(min) : n;
        if(!isNaN(Number(max))) n = n > max ? Number(max) : n;

        var c = currency.round,
          d = currency.decicmal,
          t = currency.thousands,
          s = n < 0 ? "-" : "",
          q = n,
          i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "",
          j = (j = i.length) > 3 ? j % 3 : 0;
        $l.val(currency.symbol + s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : ""));
      });
    });
    return this;
  }

  // Validator ==================
  $('input.validator, textarea.validator').focus(function ($event) {
    $(this).parent().removeClass('has-error');
    $(this).parent().find('span.help-block').html('');
  })

  $('input.validator, textarea.validator').blur(function ($event) {
    let required = $(this).prop('required');
    let minLength = $(this).data('minlength');
    let maxLength = $(this).data('maxlength');
    let str = $event.target.value.trim();

    minLength = Number(minLength);
    if (isNaN(minLength)) {
      minLength = null;
    }
    maxLength = Number(maxLength);
    if (isNaN(maxLength)) {
      maxLength = null;
    }

    if (str == '' && required) {
      $(this).parent().addClass('has-error');
      $(this).parent().find('span.help-block').html('This field is required');
    } else if (minLength && str.length < parseInt(minLength)) {
      $(this).parent().addClass('has-error');
      $(this).parent().find('span.help-block').html('This field must be least ' + minLength +' characters');
    } else if (maxLength && str.length > parseInt(maxLength)) {
      $(this).parent().addClass('has-error');
      $(this).parent().find('span.help-block').html('This field must have at most ' + maxLength +' charaters');
    } else {
      $(this).parent().removeClass('has-error');
      $(this).parent().find('span.help-block').html('');
    }
  })
  function convertToNumber(numberString) {
    numberString = numberString.replace(/\,/g, '');
    numberString = numberString.replace('$', '');
    numberString = numberString.replace(' %', '');
    const [integer, decimalpoint] = numberString.split('.');
    if (parseInt(decimalpoint) > 0) {
      return numberString;
    } else {
      return integer;
    }
  };

}(jQuery);
$("[data-currency]").currencyFormatter();
