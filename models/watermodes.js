'use strict';

module.exports = {
  // S5-Max (https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/79#issuecomment-576246934)
  gen1: [ 
    // 0%      = Off
    { homekitTopLevel: 0, miLevel: 200, name: "Off" },
    // 1-35%   = "Light"
    { homekitTopLevel: 35, miLevel: 201, name: "Light" },
    // 36-70%  = "Medium"
    { homekitTopLevel: 70, miLevel: 202, name: "Medium" },
    // 71-100% = "High"
    { homekitTopLevel: 100, miLevel: 203, name: "Hight" }
  ]
};
