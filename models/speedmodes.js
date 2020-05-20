'use strict';

module.exports = {
  gen1: [
    // 0%       = Off / Aus
    { homekitTopLevel: 0, miLevel: 0, name: "Off" },
    // 1-38%   = "Quiet / Leise"
    { homekitTopLevel: 25, miLevel: 38, name: "Quiet" },
    // 39-60%  = "Balanced / Standard"
    { homekitTopLevel: 50, miLevel: 60, name: "Balanced" },
    // 61-77%  = "Turbo / Stark"
    { homekitTopLevel: 75, miLevel: 77, name: "Turbo" },
    // 78-100% = "Full Speed / Max Speed / Max"
    { homekitTopLevel: 100, miLevel: 90, name: "Max" }
  ],
  gen2: [
    // 0%      = Off / Aus
    { homekitTopLevel: 0, miLevel: 0, name: "Off" },
    // 1-15%   = "Mop / Mopping / Nur wischen"
    { homekitTopLevel: 20, miLevel: 105, name: "Mop" },
    // 16-38%  = "Quiet / Leise"
    { homekitTopLevel: 40, miLevel: 38, name: "Quiet" },
    // 39-60%  = "Balanced / Standard"
    { homekitTopLevel: 60, miLevel: 60, name: "Balanced" },
    // 61-75%  = "Turbo / Stark"
    { homekitTopLevel: 80, miLevel: 75, name: "Turbo" },
    // 76-100% = "Full Speed / Max Speed / Max"
    { homekitTopLevel: 100, miLevel: 100, name: "Max" }
  ],
  gen3: [
    // 0%      = Off / Aus
    { homekitTopLevel: 0, miLevel: 0, name: "Off" },
    // 1-38%   = "Quiet / Leise"
    { homekitTopLevel: 25, miLevel: 101, name: "Quiet" },
    // 39-60%  = "Balanced / Standard"
    { homekitTopLevel: 50, miLevel: 102, name: "Balanced" },
    // 61-77%  = "Turbo / Stark"
    { homekitTopLevel: 75, miLevel: 103, name: "Turbo" },
    // 78-100% = "Full Speed / Max Speed / Max"
    { homekitTopLevel: 100, miLevel: 104, name: "Max" }
  ],
  // S5-Max (https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/issues/79#issuecomment-576246934)
  gen4: [ 
    // 0%      = Off / Aus
    { homekitTopLevel: 0, miLevel: 0, name: "Off" },
    // 1-15%   = "Soft"
    { homekitTopLevel: 20, miLevel: 105, name: "Soft" },
    // 16-38%   = "Quiet / Leise"
    { homekitTopLevel: 40, miLevel: 101, name: "Quiet" },
    // 39-60%  = "Balanced / Standard"
    { homekitTopLevel: 60, miLevel: 102, name: "Balanced" },
    // 61-77%  = "Turbo / Stark"
    { homekitTopLevel: 80, miLevel: 103, name: "Turbo" },
    // 78-100% = "Full Speed / Max Speed / Max"
    { homekitTopLevel: 100, miLevel: 104, name: "Max" }
  ]
};
