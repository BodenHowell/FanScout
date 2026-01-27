const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Athlete = require('../models/athlete');

// Load env vars
dotenv.config({ path: '../.env' });

// Connect to DB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');

// Initial athlete data
const athletesData = [
    {
        name: "LeBron James",
        details: "PF | No. 23 – Los Angeles Lakers",
        avatar: "images/image_23467d72.png",
        sport: "nba",
        quantity: 250,
        stats: { ppg: "25.7", apg: "8.3", rpg: "7.3" },
        bio: "One of the greatest basketball players in history, a 4-time NBA champion and MVP known for his all-around excellence and longevity.",
        currentPrice: 1266.00,
        dailyChange: 12.55,
        dailyChangePercent: 0.99,
        previousClose: 1253.45,
        afterHoursPrice: 1265.50,
        afterHoursChange: -0.50,
        afterHoursChangePercent: -0.04,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [1253.45, 1258.20, 1263.80, 1261.50, 1264.00, 1260.10, 1266.00] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [1245.00, 1250.50, 1248.90, 1253.45, 1266.00] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [1220.00, 1245.00, 1235.60, 1266.00] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [1180, 1200, 1190, 1220, 1240, 1266] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [1180, 1200, 1190, 1220, 1240, 1266] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [1150, 1190, 1180, 1220, 1266] }
    },
    {
        name: "Brock Purdy",
        details: "QB | No. 13 – San Francisco 49ers",
        avatar: "images/image_b90efac9.png",
        sport: "nfl",
        quantity: 450,
        stats: { yds: "4,280", td: "31", int: "11" },
        bio: "Quarterback for the San Francisco 49ers, known for his poise and accuracy, who led his team to a Super Bowl appearance.",
        currentPrice: 644.00,
        dailyChange: -8.10,
        dailyChangePercent: -1.24,
        previousClose: 652.10,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [652.10, 650.00, 648.50, 645.20, 646.80, 644.30, 644.00] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [660.00, 658.50, 655.00, 652.10, 644.00] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [630.00, 645.00, 658.20, 644.00] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [590, 600, 610, 630, 650, 644] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [590, 600, 610, 630, 650, 644] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [580, 610, 590, 630, 644] }
    },
    {
        name: "Carlo Emilion",
        details: "CM | No. 10 – Real Madrid",
        avatar: "images/carlo_emilion.png",
        sport: "soccer",
        quantity: 150,
        stats: { G: "12", A: "18", "Shot Acc": "88%" },
        bio: "A creative midfielder from Spain, known for his exceptional passing and vision on the field.",
        currentPrice: 234.00,
        dailyChange: 4.75,
        dailyChangePercent: 2.07,
        previousClose: 229.25,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [229.25, 230.10, 231.50, 232.00, 231.75, 233.00, 234.00] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [225.00, 226.50, 228.00, 229.25, 234.00] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [220.00, 225.00, 222.60, 234.00] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [190, 205, 210, 215, 220, 234] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [190, 205, 210, 215, 220, 234] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [180, 200, 190, 215, 234] }
    },
    {
        name: "Daniel Jay Park",
        details: "P | No. 27 – New York Yankees",
        avatar: "images/daniel_jay_park.png",
        sport: "mlb",
        quantity: 75,
        stats: { ERA: "2.85", W: "15", SO: "210" },
        bio: "A dominant starting pitcher with a blazing fastball and a sharp, unhittable curveball.",
        currentPrice: 189.50,
        dailyChange: -0.25,
        dailyChangePercent: -0.13,
        previousClose: 189.75,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [189.75, 189.60, 189.80, 189.40, 189.30, 189.55, 189.50] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [188.00, 188.50, 189.90, 189.75, 189.50] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [185.00, 186.50, 188.00, 189.50] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [170, 172, 175, 180, 185, 189.50] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [170, 172, 175, 180, 185, 189.50] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [160, 165, 170, 180, 189.50] }
    },
    {
        name: "Mark Rojas",
        details: "LW | No. 91 – Chicago Blackhawks",
        avatar: "images/mark_rojas.png",
        sport: "nhl",
        quantity: 120,
        stats: { G: "35", A: "40", "+/-": "18" },
        bio: "A dynamic winger known for his incredible stickhandling and lethal goal-scoring prowess.",
        currentPrice: 445.00,
        dailyChange: 0.00,
        dailyChangePercent: 0.00,
        previousClose: 445.00,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [445.00, 445.10, 444.80, 445.20, 445.00, 444.90, 445.00] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [440.00, 442.50, 443.00, 445.00, 445.00] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [430.00, 435.00, 440.00, 445.00] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [400, 410, 420, 430, 440, 445] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [400, 410, 420, 430, 440, 445] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [380, 390, 400, 430, 445] }
    },
    {
        name: "Tahaad Pettiford",
        details: "G | No. 0 - Auburn Tigers",
        avatar: "images/athlete_tahaad_pettiford.png",
        sport: "ncaab",
        quantity: 800,
        stats: { ppg: "15.8", apg: "4.2", rpg: "3.1" },
        bio: "Rising star guard for Auburn Tigers with exceptional court vision and shooting ability.",
        currentPrice: 10.99,
        dailyChange: 0.12,
        dailyChangePercent: 1.10,
        previousClose: 10.87,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [10.87, 10.90, 10.92, 10.95, 10.93, 10.98, 75.99] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [10.50, 10.65, 10.70, 10.87, 75.99] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [10.20, 10.40, 10.60, 10.99] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [8.50, 9.00, 9.25, 9.75, 10.50, 75.99] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [8.50, 9.00, 9.25, 9.75, 10.50, 75.99] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [7.00, 7.50, 8.50, 9.75, 75.99] }
    },
    {
        name: "Caitlin Clark",
        details: "G | No. 22 - Indiana Fever",
        avatar: "images/athlete_caitlin_clark.png",
        sport: "nba",
        quantity: 1200,
        stats: { ppg: "27.0", apg: "8.0", rpg: "7.1" },
        bio: "WNBA superstar known for her incredible range and record-breaking basketball IQ.",
        currentPrice: 9.50,
        dailyChange: -0.15,
        dailyChangePercent: -1.55,
        previousClose: 9.65,
        afterHoursPrice: 9.52,
        afterHoursChange: 0.02,
        afterHoursChangePercent: 0.21,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [9.65, 9.60, 9.55, 9.58, 9.52, 9.51, 9.50] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [9.80, 9.75, 9.70, 9.65, 9.50] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [9.90, 9.80, 9.60, 9.50] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [8.00, 8.25, 8.75, 9.25, 9.80, 9.50] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [8.00, 8.25, 8.75, 9.25, 9.80, 9.50] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [7.00, 7.50, 8.00, 9.25, 9.50] }
    },
    {
        name: "Ryan Williams",
        details: "WR | No. 2 - Alabama",
        avatar: "images/athlete_ryan_w.png",
        sport: "ncaaf",
        quantity: 650,
        stats: { rec: "48", yds: "804", td: "8" },
        bio: "Elite wide receiver prospect with game-breaking speed and reliable hands.",
        currentPrice: 17.99,
        dailyChange: 0.55,
        dailyChangePercent: 3.15,
        previousClose: 17.44,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [17.44, 17.55, 17.65, 17.80, 17.75, 17.90, 17.99] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [16.50, 16.80, 17.00, 17.44, 17.99] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [15.00, 15.50, 16.50, 17.99] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [12.00, 13.00, 14.00, 15.00, 16.50, 17.99] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [12.00, 13.00, 14.00, 15.00, 16.50, 17.99] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [10.00, 11.00, 12.00, 15.00, 17.99] }
    },
    {
        name: "Elena Petrova",
        details: "Tennis | WTA Rank: 5",
        avatar: "images/athlete_elena.png",
        sport: "tennis",
        quantity: 200,
        stats: { Aces: "250", "1st Serve %": "68%", Titles: "3" },
        bio: "A powerful baseliner with a formidable serve, quickly climbing the world tennis rankings.",
        currentPrice: 35.50,
        dailyChange: -0.20,
        dailyChangePercent: -0.56,
        previousClose: 35.70,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [35.70, 35.65, 35.60, 35.55, 35.50, 35.52, 35.50] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [36.00, 35.90, 35.80, 35.70, 35.50] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [34.00, 34.50, 35.00, 35.50] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [30.00, 31.00, 32.50, 33.50, 34.00, 35.50] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [30.00, 31.00, 32.50, 33.50, 34.00, 35.50] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [28.00, 29.00, 30.00, 33.50, 35.50] }
    },
    {
        name: "Javier \"El Fuego\" Rios",
        details: "UFC | Welterweight",
        avatar: "images/athlete_javier.png",
        sport: "ufc",
        quantity: 100,
        stats: { "W-L": "18-2", "K.O.": "12", "Sub.": "4" },
        bio: "An explosive and charismatic UFC fighter known for his knockout power and relentless pressure.",
        currentPrice: 50.25,
        dailyChange: 1.75,
        dailyChangePercent: 3.61,
        previousClose: 48.50,
        afterHoursPrice: 50.30,
        afterHoursChange: 0.05,
        afterHoursChangePercent: 0.10,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [48.50, 49.00, 49.25, 49.80, 49.75, 50.10, 80.25] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [47.00, 47.50, 48.00, 48.50, 50.25] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [45.00, 46.50, 47.00, 80.25] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [40.00, 42.00, 43.50, 45.00, 47.00, 80.25] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [40.00, 42.00, 43.50, 45.00, 47.00, 80.25] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [38.00, 39.00, 40.00, 45.00, 80.25] }
    },
    {
        name: "Kenji Tanaka",
        details: "Golf | PGA Rank: 12",
        avatar: "images/athlete_kenji.png",
        sport: "golf",
        quantity: 180,
        stats: { "Top 10s": "8", "Avg Score": "69.5", "Majors": "0" },
        bio: "A supremely accurate iron player from Japan, renowned for his calm demeanor under pressure.",
        currentPrice: 42.00,
        dailyChange: -0.05,
        dailyChangePercent: -0.12,
        previousClose: 42.05,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [42.05, 42.00, 42.10, 41.95, 42.02, 41.98, 42.00] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [41.80, 41.90, 42.15, 42.05, 42.00] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [41.00, 41.50, 41.80, 42.00] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [38.00, 39.00, 40.00, 41.00, 41.50, 42.00] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [38.00, 39.00, 40.00, 41.00, 41.50, 42.00] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [35.00, 36.50, 38.00, 41.00, 42.00] }
    },
    {
        name: "Aisha Okoro",
        details: "Track | 100m Sprinter",
        avatar: "images/athlete_aisha.png",
        sport: "track",
        quantity: 400,
        stats: { "100m PB": "10.85s", "World Rank": "3", "Medals": "5" },
        bio: "One of the fastest women in the world, aiming for gold at the next Olympic games.",
        currentPrice: 22.75,
        dailyChange: 0.45,
        dailyChangePercent: 2.02,
        previousClose: 22.30,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [22.30, 22.40, 22.55, 22.60, 22.50, 22.70, 22.75] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [21.80, 22.00, 22.10, 22.30, 22.75] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [21.00, 21.50, 22.00, 22.75] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [18.00, 19.00, 20.00, 21.00, 22.00, 22.75] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [18.00, 19.00, 20.00, 21.00, 22.00, 22.75] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [17.00, 17.50, 18.00, 21.00, 22.75] }
    },
    {
        name: "Serena Williams",
        details: "Tennis | GOAT",
        avatar: "images/athlete_serena.png",
        sport: "tennis",
        quantity: 300,
        stats: { Titles: "73", Majors: "23", Wins: "858" },
        bio: "An icon of sport and one of the most dominant tennis players of all time, known for her powerful serve and incredible determination.",
        currentPrice: 950.75,
        dailyChange: 15.25,
        dailyChangePercent: 1.63,
        previousClose: 935.50,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [935.50, 940.10, 942.80, 945.00, 948.60, 949.90, 950.75] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [920.00, 925.50, 930.00, 935.50, 950.75] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [900.00, 915.00, 925.60, 950.75] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [850, 870, 890, 900, 920, 950.75] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [850, 870, 890, 900, 920, 950.75] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [830, 860, 850, 900, 950.75] }
    },
    {
        name: "Lionel Messi",
        details: "Soccer | Inter Miami CF",
        avatar: "images/athlete_messi.png",
        sport: "soccer",
        quantity: 500,
        stats: { Goals: "800+", "Ballon d'Or": "8", Assists: "350+" },
        bio: "Widely regarded as one of the greatest soccer players of all time, famed for his dribbling, vision, and prolific goalscoring.",
        currentPrice: 880.00,
        dailyChange: -5.50,
        dailyChangePercent: -0.62,
        previousClose: 885.50,
        afterHoursPrice: 880.25,
        afterHoursChange: 0.25,
        afterHoursChangePercent: 0.03,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [885.50, 884.20, 882.80, 881.50, 883.00, 881.10, 880.00] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [890.00, 888.50, 886.90, 885.50, 880.00] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [870.00, 890.00, 885.60, 880.00] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [820, 840, 830, 860, 870, 880] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [820, 840, 830, 860, 870, 880] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [800, 830, 820, 860, 880] }
    },
    {
        name: "Patrick Mahomes",
        details: "QB | No. 15 - Kansas City Chiefs",
        avatar: "images/athlete_patrick.png",
        sport: "nfl",
        quantity: 400,
        stats: { Yards: "28,424", TDs: "233", Rating: "103.5" },
        bio: "A generational talent at quarterback, known for his incredible arm strength, creativity, and multiple Super Bowl victories.",
        currentPrice: 725.40,
        dailyChange: 10.10,
        dailyChangePercent: 1.41,
        previousClose: 715.30,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [715.30, 718.00, 720.50, 722.80, 721.90, 724.00, 725.40] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [705.00, 708.50, 712.00, 715.30, 725.40] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [690.00, 700.00, 710.20, 725.40] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [650, 670, 680, 690, 705, 725.40] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [650, 670, 680, 690, 705, 725.40] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [630, 660, 650, 690, 725.40] }
    },
    {
        name: "Sam 'The Rocket' Burns",
        details: "F1 Driver | Oracle Racing",
        avatar: "images/athlete_sam.png",
        sport: "f1",
        quantity: 50,
        stats: { Podiums: "5", Poles: "2", Wins: "1" },
        bio: "A fearless and technically gifted driver, making waves in the high-stakes world of Formula 1.",
        currentPrice: 155.00,
        dailyChange: -2.50,
        dailyChangePercent: -1.59,
        previousClose: 157.50,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [157.50, 156.80, 157.00, 156.00, 155.50, 155.20, 155.00] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [158.00, 158.50, 159.00, 157.50, 155.00] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [150.00, 152.00, 156.00, 155.00] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [130.00, 135.00, 140.00, 150.00, 158.00, 155.00] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [130.00, 135.00, 140.00, 150.00, 158.00, 155.00] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [120.00, 125.00, 130.00, 150.00, 155.00] }
    },
    {
        name: "Tom Brady",
        details: "QB | Retired - NFL Legend",
        avatar: "images/athlete_tom.png",
        sport: "nfl",
        quantity: 500,
        stats: { "S. Bowls": "7", TDs: "649", Yards: "89,214" },
        bio: "Widely considered the greatest quarterback of all time, Tom Brady is a 7-time Super Bowl champion known for his leadership and unprecedented longevity.",
        currentPrice: 985.50,
        dailyChange: 5.50,
        dailyChangePercent: 0.56,
        previousClose: 980.00,
        afterHoursPrice: null,
        afterHoursChange: null,
        afterHoursChangePercent: null,
        d1: { labels: ['10A', '11A', '12P', '1P', '2P', '3P', '4P'], data: [980.00, 981.50, 983.00, 982.50, 984.00, 984.20, 985.50] },
        d5: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], data: [970.00, 975.50, 978.00, 980.00, 985.50] },
        m1: { labels: ['W1', 'W2', 'W3', 'W4'], data: [950.00, 965.00, 970.60, 985.50] },
        m6: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [920, 930, 945, 955, 970, 985.50] },
        ytd: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], data: [920, 930, 945, 955, 970, 985.50] },
        y1: { labels: ['Jul', 'Oct', 'Jan', 'Apr', 'Jun'], data: [900, 910, 920, 955, 985.50] }
    }
];

// Utility to convert stat keys to camelCase and remove invalid characters
function sanitizeStatKey(key) {
    return key
        .replace(/[%]/g, 'Pct')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .split(' ')
        .map((word, i) => i === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

function sanitizeStats(stats) {
    const newStats = {};
    for (const key in stats) {
        newStats[sanitizeStatKey(key)] = stats[key];
    }
    return newStats;
}

athletesData.forEach(a => {
    if (a.stats) a.stats = sanitizeStats(a.stats);
});

const seedDB = async () => {
    try {
        // Delete existing data
        await Athlete.deleteMany({});
        console.log('Athlete data deleted');

        // Insert new data
        await Athlete.insertMany(athletesData);
        console.log('Athlete data seeded successfully');

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedDB();
        