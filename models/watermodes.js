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
  ],
gen3: [
// 0% = Off / Aus
{ homekitTopLevel: 0, miLevel: 0, name: "Off" },
// 1-15% = "Soft"
{ homekitTopLevel: 15, miLevel: 105, name: "Soft" },
// 16-38% = "Quiet / Leise"
{ homekitTopLevel: 38, miLevel: 101, name: "Quiet" },
// 39-60% = "Balanced / Standard"
{ homekitTopLevel: 60, miLevel: 102, name: "Balanced" },
// 61-77% = "Turbo / Stark"
{ homekitTopLevel: 77, miLevel: 103, name: "Turbo" },
// 78-100% = "Full Speed / Max Speed / Max"
{ homekitTopLevel: 100, miLevel: 104, name: "Max" }
]
};
