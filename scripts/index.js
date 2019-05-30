$(function () {
  $('[data-toggle="popover"]:not([data-ignore])').each(function() {
  	var $elem = $(this);
  	$elem.popover({
	  	container: $elem,
	  	trigger: 'hover',
	  	placement: 'bottom',
	  	delay: 400,
	  	html: true,
	  	content: function() {
	        var content = $($(this).data('content-el')).children().clone()
	        return content
	    }
	  })
  })
  $('[data-toggle="tooltip"]').tooltip()
})