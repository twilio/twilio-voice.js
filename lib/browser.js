/*! $name.js $version

$license
 */
(function(root) {
  var bundle = $bundle;
  var Voice = bundle($entry);
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Voice; });
  } else {
    var Twilio = root.Twilio = root.Twilio || {};
    Twilio.Call = Twilio.Call || Voice.Call;
    Twilio.Device = Twilio.Device || Voice.Device;
    Twilio.PStream = Twilio.PStream || Voice.PStream;
    Twilio.PreflightTest = Twilio.PreflightTest || Voice.PreflightTest;
    Twilio.Logger = Twilio.Logger || Voice.Logger;
  }
})(globalThis);
