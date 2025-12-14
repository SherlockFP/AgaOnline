const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

// Game state storage
const lobbies = new Map();
const players = new Map();

// Country-specific board configurations
const countryBoards = {
  usa: {
    name: 'USA 🇺🇸',
    currency: '$',
    spaces: [
      { id: 0, name: 'START', type: 'go', color: null, price: 0 },
      { id: 1, name: 'Times Square', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
      { id: 2, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 3, name: 'Broadway', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
      { id: 4, name: 'Income Tax', type: 'tax', color: null, price: 0, amount: 200 },
      { id: 5, name: 'JFK Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 6, name: 'Hollywood Blvd', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 7, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 8, name: 'Silicon Valley', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 9, name: 'Wall Street', type: 'property', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
      { id: 10, name: 'Prison', type: 'jail', color: null, price: 0 },
      { id: 11, name: 'Las Vegas Strip', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 12, name: 'Electric Company', type: 'utility', color: null, price: 150 },
      { id: 13, name: 'Miami Beach', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 14, name: 'Fifth Avenue', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
      { id: 15, name: 'LAX Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 16, name: 'Golden Gate', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 17, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 18, name: 'Chicago Loop', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 19, name: 'Central Park', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
      { id: 20, name: 'Free Parking', type: 'parking', color: null, price: 0 },
      { id: 21, name: 'Beverly Hills', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 22, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 23, name: 'Rodeo Drive', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 24, name: 'Manhattan', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
      { id: 25, name: "O'Hare Airport", type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 26, name: 'Pennsylvania Ave', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 27, name: 'White House', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 28, name: 'Water Works', type: 'utility', color: null, price: 150 },
      { id: 29, name: 'Capitol Hill', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
      { id: 30, name: 'Go To Prison', type: 'gotojail', color: null, price: 0 },
      { id: 31, name: 'Empire State', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 32, name: 'Statue of Liberty', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 33, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 34, name: 'Brooklyn Bridge', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
      { id: 35, name: 'Miami Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 36, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 37, name: 'Trump Tower', type: 'property', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
      { id: 38, name: 'Luxury Tax', type: 'tax', color: null, price: 0, amount: 100 },
      { id: 39, name: 'One World Trade', type: 'property', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 }
    ]
  },
  turkey: {
    name: 'Türkiye 🇹🇷',
    currency: '₺',
    spaces: [
      { id: 0, name: 'BAŞLANGIÇ', type: 'go', color: null, price: 0 },
      { id: 1, name: 'Taksim Meydanı', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
      { id: 2, name: 'Toplum Sandığı', type: 'chest', color: null, price: 0 },
      { id: 3, name: 'İstiklal Caddesi', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
      { id: 4, name: 'Gelir Vergisi', type: 'tax', color: null, price: 0, amount: 200 },
      { id: 5, name: 'İstanbul Havalimanı', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 6, name: 'Bağdat Caddesi', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 7, name: 'Şans', type: 'chance', color: null, price: 0 },
      { id: 8, name: 'Nişantaşı', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 9, name: 'Bebek Sahili', type: 'property', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
      { id: 10, name: 'Hapishane', type: 'jail', color: null, price: 0 },
      { id: 11, name: 'Galata Kulesi', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 12, name: 'Elektrik Şirketi', type: 'utility', color: null, price: 150 },
      { id: 13, name: 'Sultanahmet', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 14, name: 'Topkapı Sarayı', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
      { id: 15, name: 'Ankara Esenboğa', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 16, name: 'Kapalıçarşı', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 17, name: 'Toplum Sandığı', type: 'chest', color: null, price: 0 },
      { id: 18, name: 'Bodrum Marina', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 19, name: 'Çeşme Alaçatı', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
      { id: 20, name: 'Bedava Park', type: 'parking', color: null, price: 0 },
      { id: 21, name: 'Kızkulesi', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 22, name: 'Şans', type: 'chance', color: null, price: 0 },
      { id: 23, name: 'Boğaz Köprüsü', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 24, name: 'Dolmabahçe', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
      { id: 25, name: 'İzmir Adnan Menderes', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 26, name: 'Anıtkabir', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 27, name: 'Nemrut Dağı', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 28, name: 'Su Şirketi', type: 'utility', color: null, price: 150 },
      { id: 29, name: 'Kapadokya', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
      { id: 30, name: 'Hapse Git', type: 'gotojail', color: null, price: 0 },
      { id: 31, name: 'Sapphire', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 32, name: 'Zorlu Center', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 33, name: 'Toplum Sandığı', type: 'chest', color: null, price: 0 },
      { id: 34, name: 'İstinye Park', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
      { id: 35, name: 'Antalya Havalimanı', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 36, name: 'Şans', type: 'chance', color: null, price: 0 },
      { id: 37, name: 'Ortaköy', type: 'property', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
      { id: 38, name: 'Lüks Vergi', type: 'tax', color: null, price: 0, amount: 100 },
      { id: 39, name: 'Maslak Plazalar', type: 'property', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 }
    ]
  },
  germany: {
    name: 'Deutschland 🇩🇪',
    currency: '€',
    spaces: [
      { id: 0, name: 'START', type: 'go', color: null, price: 0 },
      { id: 1, name: 'Alexanderplatz', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
      { id: 2, name: 'Gemeinschaftskasse', type: 'chest', color: null, price: 0 },
      { id: 3, name: 'Unter den Linden', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
      { id: 4, name: 'Einkommensteuer', type: 'tax', color: null, price: 0, amount: 200 },
      { id: 5, name: 'Berlin Brandenburg', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 6, name: 'Kurfürstendamm', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 7, name: 'Ereigniskarte', type: 'chance', color: null, price: 0 },
      { id: 8, name: 'Potsdamer Platz', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 9, name: 'Brandenburger Tor', type: 'property', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
      { id: 10, name: 'Gefängnis', type: 'jail', color: null, price: 0 },
      { id: 11, name: 'Marienplatz', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 12, name: 'Elektrizitätswerk', type: 'utility', color: null, price: 150 },
      { id: 13, name: 'Oktoberfest', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 14, name: 'Neuschwanstein', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
      { id: 15, name: 'München Flughafen', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 16, name: 'Checkpoint Charlie', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 17, name: 'Gemeinschaftskasse', type: 'chest', color: null, price: 0 },
      { id: 18, name: 'Reichstag', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 19, name: 'Berliner Dom', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
      { id: 20, name: 'Freies Parken', type: 'parking', color: null, price: 0 },
      { id: 21, name: 'Zeil Frankfurt', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 22, name: 'Ereigniskarte', type: 'chance', color: null, price: 0 },
      { id: 23, name: 'Römerberg', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 24, name: 'Kölner Dom', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
      { id: 25, name: 'Frankfurt Flughafen', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 26, name: 'Rothenburg', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 27, name: 'Heidelberg', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 28, name: 'Wasserwerk', type: 'utility', color: null, price: 150 },
      { id: 29, name: 'Schwarzwald', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
      { id: 30, name: 'Gehe ins Gefängnis', type: 'gotojail', color: null, price: 0 },
      { id: 31, name: 'Mercedes Museum', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 32, name: 'BMW Welt', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 33, name: 'Gemeinschaftskasse', type: 'chest', color: null, price: 0 },
      { id: 34, name: 'Porsche Museum', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
      { id: 35, name: 'Hamburg Flughafen', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 36, name: 'Ereigniskarte', type: 'chance', color: null, price: 0 },
      { id: 37, name: 'Miniatur Wunderland', type: 'property', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
      { id: 38, name: 'Luxussteuer', type: 'tax', color: null, price: 0, amount: 100 },
      { id: 39, name: 'Europa-Park', type: 'property', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 }
    ]
  },
  japan: {
    name: 'Japan 🇯🇵',
    currency: '¥',
    spaces: [
      { id: 0, name: 'スタート', type: 'go', color: null, price: 0 },
      { id: 1, name: 'Shibuya Crossing', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
      { id: 2, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 3, name: 'Harajuku', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
      { id: 4, name: '所得税', type: 'tax', color: null, price: 0, amount: 200 },
      { id: 5, name: 'Narita Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 6, name: 'Ginza', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 7, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 8, name: 'Akihabara', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 9, name: 'Shinjuku', type: 'property', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
      { id: 10, name: '刑務所', type: 'jail', color: null, price: 0 },
      { id: 11, name: 'Tokyo Tower', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 12, name: 'Electric Company', type: 'utility', color: null, price: 150 },
      { id: 13, name: 'Senso-ji Temple', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 14, name: 'Meiji Shrine', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
      { id: 15, name: 'Haneda Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 16, name: 'Osaka Castle', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 17, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 18, name: 'Dotonbori', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 19, name: 'Universal Studios', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
      { id: 20, name: 'Free Parking', type: 'parking', color: null, price: 0 },
      { id: 21, name: 'Mount Fuji', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 22, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 23, name: 'Kyoto Bamboo', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 24, name: 'Fushimi Inari', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
      { id: 25, name: 'Kansai Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 26, name: 'Hiroshima Peace', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 27, name: 'Miyajima', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 28, name: 'Water Works', type: 'utility', color: null, price: 150 },
      { id: 29, name: 'Nara Deer Park', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
      { id: 30, name: '刑務所へ', type: 'gotojail', color: null, price: 0 },
      { id: 31, name: 'Tokyo Skytree', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 32, name: 'Rainbow Bridge', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 33, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 34, name: 'Tokyo Disney', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
      { id: 35, name: 'Chubu Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 36, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 37, name: 'Roppongi Hills', type: 'property', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
      { id: 38, name: '高級税', type: 'tax', color: null, price: 0, amount: 100 },
      { id: 39, name: 'Tokyo Midtown', type: 'property', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 }
    ]
  },
  china: {
    name: 'China 🇨🇳',
    currency: '¥',
    spaces: [
      { id: 0, name: '开始', type: 'go', color: null, price: 0 },
      { id: 1, name: 'Tiananmen Square', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
      { id: 2, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 3, name: 'Forbidden City', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
      { id: 4, name: '所得税', type: 'tax', color: null, price: 0, amount: 200 },
      { id: 5, name: 'Beijing Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 6, name: 'The Bund Shanghai', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 7, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 8, name: 'Nanjing Road', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 9, name: 'Yu Garden', type: 'property', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
      { id: 10, name: '监狱', type: 'jail', color: null, price: 0 },
      { id: 11, name: 'Great Wall', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 12, name: 'Electric Company', type: 'utility', color: null, price: 150 },
      { id: 13, name: 'Summer Palace', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 14, name: 'Temple of Heaven', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
      { id: 15, name: 'Shanghai Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 16, name: 'Terracotta Army', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 17, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 18, name: 'West Lake', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 19, name: 'Zhangjiajie', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
      { id: 20, name: 'Free Parking', type: 'parking', color: null, price: 0 },
      { id: 21, name: 'Li River', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 22, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 23, name: 'Yellow Mountain', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 24, name: 'Potala Palace', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
      { id: 25, name: 'Guangzhou Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 26, name: 'Hong Kong Harbor', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 27, name: 'Victoria Peak', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 28, name: 'Water Works', type: 'utility', color: null, price: 150 },
      { id: 29, name: 'Macau Casino', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
      { id: 30, name: '去监狱', type: 'gotojail', color: null, price: 0 },
      { id: 31, name: 'Shanghai Tower', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 32, name: 'Canton Tower', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 33, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 34, name: 'Oriental Pearl', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
      { id: 35, name: 'Shenzhen Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 36, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 37, name: 'Ping An Tower', type: 'property', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
      { id: 38, name: '奢侈税', type: 'tax', color: null, price: 0, amount: 100 },
      { id: 39, name: 'China World Trade', type: 'property', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 }
    ]
  },
  russia: {
    name: 'Russia 🇷🇺',
    currency: '₽',
    spaces: [
      { id: 0, name: 'СТАРТ', type: 'go', color: null, price: 0 },
      { id: 1, name: 'Red Square', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
      { id: 2, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 3, name: 'GUM Department', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
      { id: 4, name: 'Налог', type: 'tax', color: null, price: 0, amount: 200 },
      { id: 5, name: 'Sheremetyevo', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 6, name: 'Arbat Street', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 7, name: 'Шанс', type: 'chance', color: null, price: 0 },
      { id: 8, name: 'Tverskaya', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 9, name: 'Kremlin', type: 'property', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
      { id: 10, name: 'ТЮРЬМА', type: 'jail', color: null, price: 0 },
      { id: 11, name: 'Saint Basil', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 12, name: 'Electric Company', type: 'utility', color: null, price: 150 },
      { id: 13, name: 'Hermitage Museum', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 14, name: 'Peterhof Palace', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
      { id: 15, name: 'Domodedovo', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 16, name: 'Bolshoi Theatre', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 17, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 18, name: 'Nevsky Prospekt', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 19, name: 'Church Savior', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
      { id: 20, name: 'Free Parking', type: 'parking', color: null, price: 0 },
      { id: 21, name: 'Lake Baikal', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 22, name: 'Шанс', type: 'chance', color: null, price: 0 },
      { id: 23, name: 'Trans-Siberian', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 24, name: 'Golden Ring', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
      { id: 25, name: 'Pulkovo Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 26, name: 'Kazan Kremlin', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 27, name: 'Kizhi Island', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 28, name: 'Water Works', type: 'utility', color: null, price: 150 },
      { id: 29, name: 'Kamchatka', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
      { id: 30, name: 'В ТЮРЬМУ', type: 'gotojail', color: null, price: 0 },
      { id: 31, name: 'Moscow City', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 32, name: 'Ostankino Tower', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 33, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 34, name: 'Lakhta Center', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
      { id: 35, name: 'Vnukovo Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 36, name: 'Шанс', type: 'chance', color: null, price: 0 },
      { id: 37, name: 'Sochi Olympics', type: 'property', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
      { id: 38, name: 'Роскошный налог', type: 'tax', color: null, price: 0, amount: 100 },
      { id: 39, name: 'Federation Tower', type: 'property', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 }
    ]
  },
  world: {
    name: 'World 🌍',
    currency: '$',
    spaces: [
      { id: 0, name: 'START', type: 'go', color: null, price: 0 },
      { id: 1, name: 'New York', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
      { id: 2, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 3, name: 'Istanbul', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
      { id: 4, name: 'Income Tax', type: 'tax', color: null, price: 0, amount: 200 },
      { id: 5, name: 'Heathrow Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 6, name: 'Paris', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 7, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 8, name: 'London', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
      { id: 9, name: 'Rome', type: 'property', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
      { id: 10, name: 'Jail', type: 'jail', color: null, price: 0 },
      { id: 11, name: 'Tokyo', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 12, name: 'Electric Company', type: 'utility', color: null, price: 150 },
      { id: 13, name: 'Sydney', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
      { id: 14, name: 'Dubai', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
      { id: 15, name: 'Singapore Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 16, name: 'Barcelona', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 17, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 18, name: 'Amsterdam', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
      { id: 19, name: 'Berlin', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
      { id: 20, name: 'Free Parking', type: 'parking', color: null, price: 0 },
      { id: 21, name: 'Hong Kong', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 22, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 23, name: 'Mumbai', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
      { id: 24, name: 'Shanghai', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
      { id: 25, name: 'Dubai Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 26, name: 'Moscow', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 27, name: 'Seoul', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
      { id: 28, name: 'Water Works', type: 'utility', color: null, price: 150 },
      { id: 29, name: 'Toronto', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
      { id: 30, name: 'Go To Jail', type: 'gotojail', color: null, price: 0 },
      { id: 31, name: 'São Paulo', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 32, name: 'Mexico City', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
      { id: 33, name: 'Community Chest', type: 'chest', color: null, price: 0 },
      { id: 34, name: 'Buenos Aires', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
      { id: 35, name: 'Los Angeles Airport', type: 'railroad', color: null, price: 200, rent: [25, 50, 100, 200] },
      { id: 36, name: 'Chance', type: 'chance', color: null, price: 0 },
      { id: 37, name: 'Las Vegas', type: 'property', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
      { id: 38, name: 'Luxury Tax', type: 'tax', color: null, price: 0, amount: 100 },
      { id: 39, name: 'Monaco', type: 'property', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 }
    ]
  }
};

function getBoardSpaces(country = 'usa') {
  return countryBoards[country]?.spaces || countryBoards.usa.spaces;
}

function getCountryData(country = 'usa') {
  return countryBoards[country] || countryBoards.usa;
}

class Lobby {
  constructor(hostId, hostName, country = 'usa', appearance = '👤') {
    this.id = uuidv4();
    this.hostId = hostId;
    this.country = country;
    this.countryData = getCountryData(country);
    this.players = [{
      id: hostId,
      name: hostName,
      position: 0,
      money: 1500,
      properties: [],
      inJail: false,
      jailTurns: 0,
      color: '#FF0000',
      appearance: appearance
    }];
    this.started = false;
    this.currentTurn = 0;
    this.properties = this.countryData.spaces.map(space => ({
      ...space,
      owner: null,
      houses: 0,
      mortgaged: false
    }));
    this.tradeOffers = [];
    this.chatMessages = [];
    this.settings = {
      startingMoney: 1500,
      passGoMoney: 200,
      jailTurns: 3,
      jailFine: 50
    };
  }

  addPlayer(playerId, playerName, appearance = '👤') {
    const colors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF'];
    const usedColors = this.players.map(p => p.color);
    const availableColor = colors.find(c => !usedColors.includes(c)) || '#FFFFFF';
    
    this.players.push({
      id: playerId,
      name: playerName,
      position: 0,
      money: this.settings.startingMoney,
      properties: [],
      inJail: false,
      jailTurns: 0,
      color: availableColor,
      appearance: appearance
    });
  }

  addChatMessage(playerId, playerName, message) {
    this.chatMessages.push({
      id: uuidv4(),
      playerId,
      playerName,
      message,
      timestamp: Date.now()
    });
    // Keep only last 100 messages
    if (this.chatMessages.length > 100) {
      this.chatMessages.shift();
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    if (this.players.length === 0) return true;
    if (this.hostId === playerId && this.players.length > 0) {
      this.hostId = this.players[0].id;
    }
    return false;
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  getCurrentPlayer() {
    return this.players[this.currentTurn];
  }

  nextTurn() {
    this.currentTurn = (this.currentTurn + 1) % this.players.length;
  }

  toJSON() {
    return {
      id: this.id,
      hostId: this.hostId,
      players: this.players,
      started: this.started,
      currentTurn: this.currentTurn,
      playerCount: this.players.length,
      country: this.country,
      countryName: this.countryData.name,
      currency: this.countryData.currency
    };
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('createLobby', ({ playerName, country, appearance }) => {
    const lobby = new Lobby(socket.id, playerName, country || 'usa', appearance || '👤');
    lobbies.set(lobby.id, lobby);
    players.set(socket.id, { lobbyId: lobby.id, name: playerName });
    
    socket.join(lobby.id);
    socket.emit('lobbyCreated', { lobbyId: lobby.id, lobby: lobby.toJSON() });
    io.emit('lobbiesUpdate', Array.from(lobbies.values()).map(l => l.toJSON()));
  });

  socket.on('getLobbies', () => {
    socket.emit('lobbiesUpdate', Array.from(lobbies.values()).map(l => l.toJSON()));
  });

  socket.on('joinLobby', ({ lobbyId, playerName, appearance }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      socket.emit('error', 'Lobby not found');
      return;
    }
    if (lobby.started) {
      socket.emit('error', 'Game already started');
      return;
    }
    if (lobby.players.length >= 6) {
      socket.emit('error', 'Lobby is full');
      return;
    }

    lobby.addPlayer(socket.id, playerName, appearance || '👤');
    players.set(socket.id, { lobbyId: lobby.id, name: playerName });
    
    socket.join(lobbyId);
    io.to(lobbyId).emit('lobbyUpdate', lobby.toJSON());
    io.emit('lobbiesUpdate', Array.from(lobbies.values()).map(l => l.toJSON()));
  });

  socket.on('startGame', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const lobby = lobbies.get(playerData.lobbyId);
    if (!lobby || lobby.hostId !== socket.id) return;
    
    lobby.started = true;
    io.to(lobby.id).emit('gameStarted', {
      lobby: lobby.toJSON(),
      properties: lobby.properties,
      currentPlayer: lobby.getCurrentPlayer()
    });
    io.emit('lobbiesUpdate', Array.from(lobbies.values()).map(l => l.toJSON()));
  });

  socket.on('rollDice', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const lobby = lobbies.get(playerData.lobbyId);
    if (!lobby || !lobby.started) return;
    
    const currentPlayer = lobby.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) return;

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;

    // Handle jail
    if (currentPlayer.inJail) {
      if (dice1 === dice2) {
        currentPlayer.inJail = false;
        currentPlayer.jailTurns = 0;
      } else {
        currentPlayer.jailTurns++;
        if (currentPlayer.jailTurns >= 3) {
          currentPlayer.inJail = false;
          currentPlayer.jailTurns = 0;
          currentPlayer.money -= 50;
        } else {
          io.to(lobby.id).emit('diceRolled', { dice1, dice2, player: currentPlayer, message: 'Still in jail' });
          lobby.nextTurn();
          io.to(lobby.id).emit('turnChanged', lobby.getCurrentPlayer());
          return;
        }
      }
    }

    currentPlayer.position = (currentPlayer.position + total) % 40;
    
    // Pass GO
    if (currentPlayer.position < total && currentPlayer.position + total >= 40) {
      currentPlayer.money += 200;
    }

    const landedSpace = lobby.properties[currentPlayer.position];
    
    io.to(lobby.id).emit('diceRolled', { 
      dice1, 
      dice2, 
      player: currentPlayer, 
      landedSpace 
    });
    
    handleLandedSpace(lobby, currentPlayer, landedSpace);
  });

  socket.on('buyProperty', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const lobby = lobbies.get(playerData.lobbyId);
    if (!lobby) return;
    
    const player = lobby.getPlayer(socket.id);
    const property = lobby.properties[player.position];
    
    if (property.type === 'property' || property.type === 'railroad' || property.type === 'utility') {
      if (!property.owner && player.money >= property.price) {
        player.money -= property.price;
        property.owner = player.id;
        player.properties.push(property.id);
        
        io.to(lobby.id).emit('propertyBought', { player, property });
        io.to(lobby.id).emit('gameUpdate', {
          players: lobby.players,
          properties: lobby.properties
        });
      }
    }
  });

  socket.on('endTurn', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const lobby = lobbies.get(playerData.lobbyId);
    if (!lobby) return;
    
    if (lobby.getCurrentPlayer().id === socket.id) {
      lobby.nextTurn();
      io.to(lobby.id).emit('turnChanged', lobby.getCurrentPlayer());
    }
  });

  socket.on('proposeTrade', ({ targetPlayerId, offeredProperties, offeredMoney, requestedProperties, requestedMoney }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const lobby = lobbies.get(playerData.lobbyId);
    if (!lobby) return;

    const trade = {
      id: uuidv4(),
      fromPlayer: socket.id,
      toPlayer: targetPlayerId,
      offeredProperties,
      offeredMoney,
      requestedProperties,
      requestedMoney,
      status: 'pending'
    };

    lobby.tradeOffers.push(trade);
    io.to(lobby.id).emit('tradeProposed', trade);
  });

  socket.on('respondTrade', ({ tradeId, accept }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const lobby = lobbies.get(playerData.lobbyId);
    if (!lobby) return;

    const tradeIndex = lobby.tradeOffers.findIndex(t => t.id === tradeId);
    if (tradeIndex === -1) return;

    const trade = lobby.tradeOffers[tradeIndex];
    if (trade.toPlayer !== socket.id) return;

    if (accept) {
      const fromPlayer = lobby.getPlayer(trade.fromPlayer);
      const toPlayer = lobby.getPlayer(trade.toPlayer);

      // Transfer money
      fromPlayer.money -= trade.offeredMoney;
      fromPlayer.money += trade.requestedMoney;
      toPlayer.money += trade.offeredMoney;
      toPlayer.money -= trade.requestedMoney;

      // Transfer properties
      trade.offeredProperties.forEach(propId => {
        const prop = lobby.properties[propId];
        prop.owner = toPlayer.id;
        fromPlayer.properties = fromPlayer.properties.filter(p => p !== propId);
        toPlayer.properties.push(propId);
      });

      trade.requestedProperties.forEach(propId => {
        const prop = lobby.properties[propId];
        prop.owner = fromPlayer.id;
        toPlayer.properties = toPlayer.properties.filter(p => p !== propId);
        fromPlayer.properties.push(propId);
      });

      trade.status = 'accepted';
      io.to(lobby.id).emit('tradeCompleted', { trade, players: lobby.players, properties: lobby.properties });
    } else {
      trade.status = 'rejected';
      io.to(lobby.id).emit('tradeRejected', trade);
    }

    lobby.tradeOffers.splice(tradeIndex, 1);
  });

  socket.on('payRent', ({ amount, toPlayerId }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const lobby = lobbies.get(playerData.lobbyId);
    if (!lobby) return;

    const fromPlayer = lobby.getPlayer(socket.id);
    const toPlayer = lobby.getPlayer(toPlayerId);

    if (fromPlayer.money >= amount) {
      fromPlayer.money -= amount;
      toPlayer.money += amount;
      io.to(lobby.id).emit('rentPaid', { fromPlayer, toPlayer, amount });
      io.to(lobby.id).emit('gameUpdate', { players: lobby.players });
    }
  });

  socket.on('sendMessage', ({ message }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const lobby = lobbies.get(playerData.lobbyId);
    if (!lobby) return;

    const player = lobby.getPlayer(socket.id);
    lobby.addChatMessage(socket.id, player.name, message);
    
    io.to(lobby.id).emit('newMessage', {
      playerId: socket.id,
      playerName: player.name,
      message: message,
      timestamp: Date.now()
    });
  });

  socket.on('updateSettings', (newSettings) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;
    
    const lobby = lobbies.get(playerData.lobbyId);
    if (!lobby || lobby.hostId !== socket.id || lobby.started) return;

    lobby.updateSettings(newSettings);
    io.to(lobby.id).emit('settingsUpdated', lobby.settings);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const playerData = players.get(socket.id);
    
    if (playerData) {
      const lobby = lobbies.get(playerData.lobbyId);
      if (lobby) {
        const isEmpty = lobby.removePlayer(socket.id);
        
        if (isEmpty) {
          lobbies.delete(lobby.id);
        } else {
          io.to(lobby.id).emit('lobbyUpdate', lobby.toJSON());
        }
        
        io.emit('lobbiesUpdate', Array.from(lobbies.values()).map(l => l.toJSON()));
      }
      players.delete(socket.id);
    }
  });
});

function handleLandedSpace(lobby, player, space) {
  if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
    if (space.owner && space.owner !== player.id && !space.mortgaged) {
      const owner = lobby.getPlayer(space.owner);
      let rent = 0;

      if (space.type === 'property') {
        rent = space.rent[space.houses];
      } else if (space.type === 'railroad') {
        const railroadCount = lobby.properties.filter(p => 
          p.type === 'railroad' && p.owner === space.owner
        ).length;
        rent = space.rent[railroadCount - 1];
      } else if (space.type === 'utility') {
        const utilityCount = lobby.properties.filter(p => 
          p.type === 'utility' && p.owner === space.owner
        ).length;
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        rent = (dice1 + dice2) * (utilityCount === 1 ? 4 : 10);
      }

      io.to(lobby.id).emit('rentDue', { player, owner, amount: rent, property: space });
    }
  } else if (space.type === 'tax') {
    player.money -= space.amount;
    io.to(lobby.id).emit('taxPaid', { player, amount: space.amount });
  } else if (space.type === 'gotojail') {
    player.inJail = true;
    player.position = 10;
    player.jailTurns = 0;
    io.to(lobby.id).emit('playerJailed', player);
  }

  io.to(lobby.id).emit('gameUpdate', {
    players: lobby.players,
    properties: lobby.properties
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
