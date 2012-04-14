$(document).ready(function() {
  $('#bounty_board .listview .indent').hide();
  
  $('.form-el.fade-label').each(function() {
    var $label = $(this).find('label'),
        $field = $(this).find('input');
    $field
      .focus(function() {
        if($field.val() == '') {
          $label.fadeTo(300, .7);
        }
      })
      .keydown(function() {
        $label.hide();
        $label.css('z-index', -5);
      })
      .blur(function() {
        if($field.val() == '') {
          $label.css('z-index', 1);
          $label.show();
          $label.fadeTo(300, 1);
        }
      });
    if($field.val() !== '') {
      $label.hide();
    }
  });
  
  
  $('#bounty_board .listview .indent').each(function() {
    var $detail = $(this),
        $item = $detail.prev(),
        $expand = $item.find('.expand');
    $expand.toggle(function() {
      $detail.slideDown('fast');
      $expand.text('[-]');
    }, function() {
      $detail.slideUp('fast');
      $expand.text('[+]');
    });
  });
});