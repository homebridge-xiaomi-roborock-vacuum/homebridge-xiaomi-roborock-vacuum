# homebridge-xiaomi-roborock-vacuum

## Homebridge Plugin für Xiaomi Roborock's 

Mit diesem [Homebridge](https://github.com/nfarina/homebridge) Plugin kann man die Xiaomi Saugroboter (Roborock) in Apple HomeKit, als **Ventilator/Lüfter** einbinden. 

Dieses Plugin nutzt, glücklicherweise, die [miio](https://github.com/aholstenson/miio) Version 0.15.6 oder neuer, nicht wie viele andere Plugins Version 0.14.1. Damit gehören Timeouts, API-Fehler vorerst der _Vergangenheit_ an!

<img src="https://raw.githubusercontent.com/nicoh88/homebridge-xiaomi-roborock-vacuum/master/rockrobo.vacuum.v1.jpg" style="border:1px solid lightgray" alt="Xiaomi Mi Robot 1st Generation (Roborock Vacuum V1)" width="300">&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/nicoh88/homebridge-xiaomi-roborock-vacuum/master/roborock.vacuum.s5.jpg" style="border:1px solid lightgray" alt="Xiaomi Roborock S50 2nd Generation (Roborock Vacuum S5)" width="300">


## Features

* **Ventilator/Lüfter** als Ein-/Aus-Schalter. Beim Ausschalten, direkt zurück zur Ladestation.
* Geschwindigkeitsstufen per 3D-Touch / Force-Touch einstellbar.
  - Off (0%)
  - Quiet (1-38%)
  - Balanced (39-60%)
  - Turbo (61-77%)
  - Max Speed (78-100%)
* Batteriestatus und Zustand in den Gerätedetails. Warnung bei niedrigem Batteriestand.
* Schalter für Pause (Optional).
* Belegesensor (ähnlich Bewegungssensor) für Dockstatus (Optional).

<img src="https://github.com/nicoh88/homebridge-xiaomi-roborock-vacuum/blob/master/screenshot.jpg?raw=true" alt="Screenshot Apple HomeKit with homebridge-xiaomi-roborock-vacuum" width="350">


## Anleitung

1. Installation:

`npm install -g homebridge-xiaomi-mi-robot-vacuum --unsafe-perm`

2. Homebridge Konfiguration `config.json` anpassen:

```
"accessories": [
 {
  "accessory": "XiaomiRoborockVacuum",
  "name": "Xiaomi Mi Robot Vaccum 1st Generation",
  "ip": "192.168.1.150",
  "token": "abcdef1234567890abcdef1234567890",
  "pause": false,
  "dock": true
 },
],
```

2.1. Bei zwei oder mehr Saugrobotern jeweils einen weiteren "accessory" Block hinzufügen: 

```
"accessories": [
 {
  "accessory": "XiaomiRoborockVacuum",
  "name": "Xiaomi Mi Robot Vaccum 1st Generation",
  "ip": "192.168.1.150",
  "token": "abcdef1234567890abcdef1234567890",
  "pause": false,
  "dock": true
 },
 {
  "accessory": "XiaomiRoborockVacuum",
  "name": "Xiaomi Roborock S50 Vaccum 2nd Generation",
  "ip": "192.168.1.151",
  "token": "1234567890abcdef1234567890abcdef",
  "pause": false,
  "dock": true
 }
],
```

3. Homebridge neustarten


## Optionale Parameter

| Parameter | Standard  | Erklärung |
|---|---|---|
| `pause` | false | Zeigt einen zusätzlichen Schalter für "Pause" an |
| `dock` | false | Zeigt einen Belegesensor für den Dockstatus an |


## Xiaomi Token

Um dieses Plugin nutzen zu können, muss man den sogenannten "Token" des Xiaomi Saugrobters auslesen. Hier ein paar ausführliche Anleitungen:
- [Apple HomeKit Forum - HomeKit.Community](https://forum.smartapfel.de/forum/thread/370-xiaomi-token-auslesen/)
- [MiRobot2Lox Token extrahieren](http://www.loxwiki.eu/display/LOXBERRY/Token+extrahieren)
- [Homematic-Guru.de](https://homematic-guru.de/xiaomi-vacuum-staubsauger-roboter-mit-homematic-steuern)


## Lizenz

The MIT License (MIT)

Copyright (c) 2018 Nico Hartung

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

