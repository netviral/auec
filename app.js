// Import required Node.js modules and external packages
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
// create a custom timestamp format for log statements
const SimpleNodeLogger = require('simple-node-logger'),
	opts = {
		logFilePath:'re-backup-votes.log',
		timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS'
	},
log = SimpleNodeLogger.createSimpleLogger( opts );
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const cors = require("cors");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const fs=require("fs");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
// Configure Google OAuth 2.0 strategy for Passport.js
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  },
  (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});
const mongoose = require("mongoose");

const Schema = mongoose.Schema;

// Define the schema for the users collection
const userSchema = new Schema({
  name: String,
  email: { type: String, unique: true }, 
  voted1: Boolean,
  voted2: Boolean,
  opened1: Number,
  opened2: Number,
  suspicious: Boolean
});

// Define the schema for the votes collection
const voteSchema = new Schema({
  identifier: String,
  type: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
// Update the updatedAt field whenever a document is updated
voteSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create models for the schemas
const User = mongoose.model('User', userSchema);
const Vote = mongoose.model('Vote', voteSchema);

// MongoDB configuration
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;
db.on("error", (error) => {
  console.error("MongoDB connection error:", error);
});
db.once("open", () => {
  console.log("Connected to MongoDB for Session Store");
});

const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: "sessions"
});

app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.use(cookieParser());
app.use(session({
  secret: process.env.SECRET_KEY,
  store: store,
  saveUninitialized: false,
  resave: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 3 * 24 * 60 * 60 * 1000
  }
}));

// Serve static files from the "public" directory
app.use(
    "/",
    express.static(__dirname + "/public", {
      dotfiles: "ignore", // Ignore dotfiles (e.g., .gitignore)
      etag: false, // Disable ETags for better caching control
      extensions: ["htm", "html"], // Serve HTML files without specifying the extension
      index: false, // Disable directory listing
      maxAge: "2d", // Cache static assets for two days
      redirect: false, // Disable automatic redirect
      setHeaders(res, path, stat) {
        res.set("x-timestamp", Date.now()); // Set custom response header
      },
    })
  );
app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
      // If user is authenticated, show "logged in" message
      res.render("index",{user:req.user._json});
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
});

app.get("/instructions", (req, res) => {
    if (req.isAuthenticated()) {
      // If user is authenticated, show "logged in" message
      res.render("inner-page",{user:req.user._json});
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
  });

// app.get("/vote", (req, res) => {
//     if (req.isAuthenticated()) {
//       // If user is authenticated, show "logged in" message
//       User.findOne({ email: req.user._json.email})
//             .then(user => {
//                 var voted1=user.voted1;
//                 var voted2=user.voted2;
//                 var opened1Twice=user.opened1<5?false:true;
//                 var opened2Twice=user.opened2<5?false:true;
//                 res.render("voting",{user:user,voted1:voted1,voted2:voted2,opened1Twice:opened1Twice,opened2Twice:opened2Twice});
//             })
//             .catch(err => {
//                 console.error("Error finding user:", err);
//                 res.redirect("/");
//         });
//     } else {
//       // If user is not authenticated, redirect to Google OAuth authentication
//       res.redirect("/auth/google");
//     }
//   });

// app.get("/vote/president", (req, res) => {
//     if (req.isAuthenticated()) {
//         if(req.user._json.email.includes("_")){
//             // If user is authenticated, show "logged in" message
//             var pairs=JSON.parse(fs.readFileSync("re-president.json"));
//             User.findOne({ email: req.user._json.email})
//             .then(user => {
//                 if(user.voted1){
//                     // res.send("You have already voted.");
//                     res.redirect("/vote");
//                 }else{
//                     if (user.opened1<5) {
//                         res.render("president",{user:req.user._json,council:pairs,allowed:1});
//                     } else {
//                         res.send("You've opened this page " +user.opened1+" times, hence quarantined. Please contact the developers at ibrahim.khalil_ug25@ashoka.edu.in.")
//                     }
//                 }
//             })
//             .catch(err => {
//                 console.error("Error finding user:", err);
//             });

//             User.findOneAndUpdate({ email: req.user._json.email }, { $inc: { opened1: 1 } }, { new: true })
//             .then(updatedUser => {
//                 if (updatedUser) {
//                 console.log("User updated successfully:", updatedUser);
//                 } else {
//                 console.log("User not found.");
//                 }
//             })
//             .catch(err => {
//                 console.error("Error updating user:", err);
//             });
//         }else{
//             res.send("Only students allowed to vote!")
//         }
//       } else {
//         // If user is not authenticated, redirect to Google OAuth authentication
//         res.redirect("/auth/google");
//       }
// });

// app.get("/vote/ug-council", (req, res) => {
//     if (req.isAuthenticated()) {
//       // If user is authenticated, show "logged in" message
//       if(req.user._json.email.includes("_ug") || req.user._json.email.includes("_asp")){
//         var ugCouncil=JSON.parse(fs.readFileSync("ug-council.json"));
//         User.findOne({ email: req.user._json.email})
//         .then(user => {
//             if(user.voted2){
//                 res.send("You have already voted.");
//             }else{
//                 if (user.opened2<5) {
//                     res.render("ug",{user:req.user._json,council:ugCouncil,allowed:15});
//                 } else {
//                     res.send("You've opened this page " +user.opened2+" times. Please contact the developers at ibrahim.khalil_ug25@ashoka.edu.in.")
//                 }
//             }
//         })
//         .catch(err => {
//             console.error("Error finding user:", err);
//         });

//         User.findOneAndUpdate({ email: req.user._json.email }, { $inc: { opened2: 1 } }, { new: true })
//             .then(updatedUser => {
//                 if (updatedUser) {
//                 console.log("User updated successfully:", updatedUser);
//                 } else {
//                 console.log("User not found.");
//                 }
//             })
//             .catch(err => {
//                 console.error("Error updating user:", err);
//             });
//       }else{
//         res.sendStatus(404);
//       }
//     } else {
//       // If user is not authenticated, redirect to Google OAuth authentication
//       res.redirect("/auth/google");
//     }
//   });

// app.get("/vote/masters-council", (req, res) => {
//     if (req.isAuthenticated()) {
//       // If user is authenticated, show "logged in" message
//       if(req.user._json.email.includes("_ma") || req.user._json.email.includes("_msc")){
//         var mastersCouncil=JSON.parse(fs.readFileSync("masters-council.json"));
//         User.findOne({ email: req.user._json.email})
//         .then(user => {
//             if(user.voted2){
//                 res.send("You have already voted.");
//             }else{
//                 if (user.opened2<5) {
//                     res.render("masters",{user:req.user._json,council:mastersCouncil,allowed:2});
//                 } else {
//                     res.send("You've opened this page" +user.opened2+" times. Please contact the developers at ibrahim.khalil_ug25@ashoka.edu.in.")
//                 }
//             }
//         })
//         .catch(err => {
//             console.error("Error finding user:", err);
//         });
        
//         User.findOneAndUpdate({ email: req.user._json.email }, { $inc: { opened2: 1 } }, { new: true })
//             .then(updatedUser => {
//                 if (updatedUser) {
//                 console.log("User updated successfully:", updatedUser);
//                 } else {
//                 console.log("User not found.");
//                 }
//             })
//             .catch(err => {
//                 console.error("Error updating user:", err);
//             });
//       }else{
//         res.sendStatus(404);
//       }
//     } else {
//       // If user is not authenticated, redirect to Google OAuth authentication
//       res.redirect("/auth/google");
//     }
//   });

// app.get("/vote/phd-council", (req, res) => {
//     if (req.isAuthenticated()) {
//       // If user is authenticated, show "logged in" message
//       if(req.user._json.email.includes("_phd")){
//         var phdCouncil=JSON.parse(fs.readFileSync("phd-council.json"));
//         User.findOne({ email: req.user._json.email})
//         .then(user => {
//             if(user.voted2){
//                 res.send("You have already voted.");
//             }else{
//                 if (user.opened2<5) {
//                     res.render("phd",{user:req.user._json,council:phdCouncil,allowed:2});
//                 } else {
//                     res.send("You've opened this page" +user.opened2+" times. Please contact the developers at ibrahim.khalil_ug25@ashoka.edu.in.")
//                 }
//             }
//         })
//         .catch(err => {
//             console.error("Error finding user:", err);
//         });
        
//         User.findOneAndUpdate({ email: req.user._json.email }, { $inc: { opened2: 1 } }, { new: true })
//             .then(updatedUser => {
//                 if (updatedUser) {
//                 console.log("User updated successfully:", updatedUser);
//                 } else {
//                 console.log("User not found.");
//                 }
//             })
//             .catch(err => {
//                 console.error("Error updating user:", err);
//             });
//       }else{
//         res.sendStatus(404);
//       }
//     } else {
//       // If user is not authenticated, redirect to Google OAuth authentication
//       res.redirect("/auth/google");
//     }
//   });

//   app.post("/submit-votes/ug", (req, res) => {
//     var message="";
//     if (req.isAuthenticated()) {
//         if(req.user._json.email.includes("_ug") || req.user._json.email.includes("_asp")){
//             User.findOne({ email: req.user._json.email})
//             .then(user => {
//                 if (!user.voted2) {
//                     var uniqueAffiliations = [...new Set(Object.values(req.body).map(item => item.affiliation))];
//                     uniqueAffiliations=uniqueAffiliations.slice(0,15); // maximum of 15 allowed
//                     uniqueAffiliations.forEach(affiliation => {
//                         // Create a newVote for each unique affiliation
//                         fs.readFile('ug-council.json', 'utf8', (err, data) => {
//                             if (err) {
//                               console.error('Error reading file:', err);
//                               return;
//                             }
                          
//                             var allowedAffiliations = [...new Set(JSON.parse(data).map(obj => obj.uuid))];
//                             allowedAffiliations.push("4fe0588e-9bbf-4128-914b-838439288224"); // NOTA id
//                             if(allowedAffiliations.includes(affiliation)){
//                                 const newVote = new Vote({
//                                     identifier: affiliation,
//                                     type: "UG",
//                                 });
//                                 // Save the newVote to the database
//                                 newVote.save().then(() => {
//                                     console.log(`New vote created for affiliation: ${affiliation}`);
//                                     User.findOneAndUpdate({ email: req.user._json.email }, { voted2:true })
//                                     .then(updatedUser => {
//                                         if (updatedUser) {
//                                           console.log("User updated successfully:", updatedUser);
//                                           res.send("Your vote was registered. Thank you for your time.");
//                                         } else {
//                                           console.log("User not found.");
//                                           message+="User not found.";
//                                         }
//                                     })
//                                     .catch(err => {
//                                         console.error("Error updating user:", err);
//                                         message+="An error occurred.";
//                                     });
//                                 }).catch(err => {
//                                     console.error('Error creating new vote:', err);
//                                     message+="An error occurred.";
//                                 });
//                                 log.info('vote ', affiliation, ' type ', "UG ", new Date().toJSON());
//                             }else{
//                                 console.log("No such affiliation for: "+ affiliation);
//                                 message+="An error occurred.";
//                             }  
//                           });
//                     });
//                 } else {
//                     message=+"Your vote is already registered. Contact ibrahim.khalil_ug25@ashoka.edu.in in case you feel this is an error.";
//                 }
//             })
//             .catch(err => {
//                 console.error("Error finding user:", err);
//                 message+="Error finding user";
//             });
//         }else{
//           res.send("Not an eligible student.");
//         }
//     } else {
//       res.redirect("/");
//     }
//   });
  

//   app.post("/submit-votes/masters", (req, res) => {
//     if (req.isAuthenticated()) {
//         if(req.user._json.email.includes("_ma") || req.user._json.email.includes("_msc")){
//             User.findOne({ email: req.user._json.email})
//             .then(user => {
//                 if (!user.voted2) {
//                     var uniqueAffiliations = [...new Set(Object.values(req.body).map(item => item.affiliation))];
//                     uniqueAffiliations=uniqueAffiliations.slice(0,2); // maximum of 2 allowed
//                     uniqueAffiliations.forEach(affiliation => {
//                         fs.readFile('masters-council.json', 'utf8', (err, data) => {
//                             if (err) {
//                               console.error('Error reading file:', err);
//                               return;
//                             }
                          
//                             var allowedAffiliations = [...new Set(JSON.parse(data).map(obj => obj.uuid))];
//                             allowedAffiliations.push("ef0b976e-c1c0-4e4c-a015-0cf81ac47fd3"); // NOTA id
//                             if(allowedAffiliations.includes(affiliation)){
//                                 const newVote = new Vote({
//                                     identifier: affiliation,
//                                     type: "MASTERS",
//                                 });
        
//                                 // Save the newVote to the database
//                                 newVote.save().then(() => {
//                                     console.log(`New vote created for affiliation: ${affiliation}`);
//                                     User.findOneAndUpdate({ email: req.user._json.email }, { voted2:true })
//                                     .then(updatedUser => {
//                                         if (updatedUser) {
//                                         console.log("User updated successfully:", updatedUser);
//                                         res.send("Your vote was registered. Thank you for your time.")
//                                         } else {
//                                         console.log("User not found.");
//                                         }
//                                     })
//                                     .catch(err => {
//                                         console.error("Error updating user:", err);
//                                     });
//                                 }).catch(err => {
//                                     console.error('Error creating new vote:', err);
//                                 });
//                                 log.info('vote ', affiliation, ' type ', "MASTERS ", new Date().toJSON());
//                             }else{
//                                 console.log("No such affiliation for: "+ affiliation);
//                             }
                          
//                           });
//                     });
//                 } else {
//                     res.send("Your vote is already registered. Contact ibrahim.khalil_ug25@ashoka.edu.in in case you feel this is an error.")
//                 }
//             })
//             .catch(err => {
//                 console.error("Error finding user:", err);
//             });
//         }else{
//             res.send("Not an eligible student.");
//         }
//       console.log(req.body);
//     } else {
//       // If user is not authenticated, redirect to Google OAuth authentication
//       res.redirect("/auth/google");
//     }
//   });


//   app.post("/submit-votes/phd", (req, res) => {
//     if (req.isAuthenticated()) {
//         if(req.user._json.email.includes("_phd")){
//             User.findOne({ email: req.user._json.email})
//             .then(user => {
//                 if (!user.voted2) {
//                     var uniqueAffiliations = [...new Set(Object.values(req.body).map(item => item.affiliation))];
//                     uniqueAffiliations=uniqueAffiliations.slice(0,2); // maximum of 2 allowed
//                     uniqueAffiliations.forEach(affiliation => {
//                         fs.readFile('phd-council.json', 'utf8', (err, data) => {
//                             if (err) {
//                               console.error('Error reading file:', err);
//                               return;
//                             }
                          
//                             var allowedAffiliations = [...new Set(JSON.parse(data).map(obj => obj.uuid))];
//                             allowedAffiliations.push("de83a521-3d47-4671-b49d-2cd4feeb98b4"); // NOTA id
//                             if(allowedAffiliations.includes(affiliation)){
//                                 const newVote = new Vote({
//                                     identifier: affiliation,
//                                     type: "PHD",
//                                 });
        
//                                 // Save the newVote to the database
//                                 newVote.save().then(() => {
//                                     console.log(`New vote created for affiliation: ${affiliation}`);
//                                     User.findOneAndUpdate({ email: req.user._json.email }, { voted2:true })
//                                     .then(updatedUser => {
//                                         if (updatedUser) {
//                                         console.log("User updated successfully:", updatedUser);
//                                         res.send("Your vote was registered. Thank you for your time.")
//                                         } else {
//                                         console.log("User not found.");
//                                         }
//                                     })
//                                     .catch(err => {
//                                         console.error("Error updating user:", err);
//                                     });
//                                 }).catch(err => {
//                                     console.error('Error creating new vote:', err);
//                                 });
//                                 log.info('vote ', affiliation, ' type ', "PHD ", new Date().toJSON());
//                             }else{
//                                 console.log("No such affiliation for: "+ affiliation);
//                             }
                          
//                           });
//                     });
//                 } else {
//                     res.send("Your vote is already registered. Contact ibrahim.khalil_ug25@ashoka.edu.in in case you feel this is an error.")
//                 }
//             })
//             .catch(err => {
//                 console.error("Error finding user:", err);
//             });
//         }else{
//             res.send("Not an eligible student.");
//         }
//     } else {
//       // If user is not authenticated, redirect to Google OAuth authentication
//       res.redirect("/auth/google");
//     }
//   });
  // app.post("/submit-votes/president", (req, res) => {
  //   if (req.isAuthenticated()) {
  //       if(req.user._json.email.includes("_")){
  //           User.findOne({ email: req.user._json.email})
  //           .then(user => {
  //               if (!user.voted1) {
  //                   var uniqueAffiliations = [...new Set(Object.values(req.body).map(item => item.affiliation))];
  //                   uniqueAffiliations=uniqueAffiliations.slice(0,1); // maximum of 1 allowed
  //                   uniqueAffiliations.forEach(affiliation => {
  //                       fs.readFile('re-president.json', 'utf8', (err, data) => {
  //                           if (err) {
  //                             console.error('Error reading file:', err);
  //                             return;
  //                           }
                          
  //                           var allowedAffiliations = [...new Set(JSON.parse(data).map(obj => obj.uuid))];
  //                           allowedAffiliations.push("4ba36c5f-9f7e-466b-ad52-d8c46f09b01e"); // NOTA id
  //                           if(allowedAffiliations.includes(affiliation)){
  //                               const newVote = new Vote({
  //                                   identifier: affiliation,
  //                                   type: "PRESIDENT",
  //                               });
  //                               // Save the newVote to the database
  //                               newVote.save().then(() => {
  //                                   console.log(`New vote created for affiliation: ${affiliation}`);
  //                                   User.findOneAndUpdate({ email: req.user._json.email }, { voted1:true })
  //                                   .then(updatedUser => {
  //                                       if (updatedUser) {
  //                                       console.log("User updated successfully:", updatedUser);
  //                                       res.send("Your vote was registered. Thank you for your time. On the popup after this, please select 'Leave Site', rest assured your vote is saved with us.");
  //                                       } else {
  //                                       console.log("User not found.");
  //                                       }
  //                                   })
  //                                   .catch(err => {
  //                                       console.error("Error updating user:", err);
  //                                   });
  //                               }).catch(err => {
  //                                   console.error('Error creating new vote:', err);
  //                               });
  //                               log.info('vote ', affiliation, ' type ', "PRESIDENT ", new Date().toJSON());
  //                           }else{
  //                               console.log("No such affiliation for: "+ affiliation);
  //                           }
  //                         });
  //                   });
  //               } else {
  //                   res.send("Your vote is already registered. Contact ibrahim.khalil_ug25@ashoka.edu.in in case you feel this is an error.")
  //               }
  //           })
  //           .catch(err => {
  //               console.error("Error finding user:", err);
  //           });
  //       }else{
  //           res.send("Not an eligible student.");
  //       }
  //     console.log(req.body);
  //   } else {
  //     // If user is not authenticated, redirect to Google OAuth authentication
  //     res.redirect("/auth/google");
  //   }
  // });

// app.get("/summary", function(req,res){
//     if(req.query.key==111222333 && req.query.toy==333222111){
//       const getVoteCountsByType = () => {
//             const counts = {};
//             return Vote.countDocuments({ type: "UG" }).then(count => {
//             counts.UG = count;
//             return Vote.countDocuments({ type: "MASTERS" });
//           }).then(count => {
//             counts.MASTERS = count;
//             return Vote.countDocuments({ type: "PHD" });
//           }).then(count => {
//             counts.PHD = count;
//             return Vote.countDocuments({ type: "PRESIDENT" });
//           }).then(count => {
//             counts.PRESIDENT = count;
//             return counts;
//           }).catch(err => {
//             console.error('Error counting votes by type:', err);
//             throw err;
//           });
//       };

//       const getTotalUserCount = () => {
//         return User.countDocuments().then(count => {
//           return count;
//         }).catch(err => {
//           console.error('Error counting total users:', err);
//           throw err;
//         });
//       };

//       const getVoted1UserCount = () => {
//         return User.countDocuments({ voted1: true }).then(count => {
//           return count;
//         }).catch(err => {
//           console.error('Error counting users who voted in presidential election:', err);
//           throw err;
//         });
//       };

//       const getVoted2UserCount = () => {
//         return User.countDocuments({ voted2: true }).then(count => {
//           return count;
//         }).catch(err => {
//           console.error('Error counting users who voted in another election:', err);
//           throw err;
//         });
//       };

//       const getUGorASPUsersVoted2Count = () => {
//         return User.countDocuments({ $and: [{ $or: [{ email: /_ug/ }, { email: /_asp/ }] }, { voted2: true }] }).then(count => {
//           return count;
//         }).catch(err => {
//           console.error('Error counting users with _ug or _asp in email who voted in another election:', err);
//           throw err;
//         });
//       };

//       const getMSCorMAUsersVoted2Count = () => {
//         return User.countDocuments({ $and: [{ $or: [{ email: /_msc/ }, { email: /_ma/ }] }, { voted2: true }] }).then(count => {
//           return count;
//         }).catch(err => {
//           console.error('Error counting users with _msc or _ma in email who voted in another election:', err);
//           throw err;
//         });
//       };

//       const getPhDUsersVoted2Count = () => {
//         return User.countDocuments({ $and: [{ email: /_phd/ }, { voted2: true }] }).then(count => {
//           return count;
//         }).catch(err => {
//           console.error('Error counting users with _phd in email who voted in another election:', err);
//           throw err;
//         });
//       };

//       // Driver code
//       Promise.all([
//         getVoteCountsByType(), // How many votes for each of UG, Masters and Presidential
//         getTotalUserCount(), // Total users on the site
//         getVoted1UserCount(), // how many users have voted for presidential elections
//         getVoted2UserCount(), // how many users have voted for UG/Masters/PhD in total
//         getUGorASPUsersVoted2Count(), // How many users have voted for UG Council
//         getMSCorMAUsersVoted2Count(), // How many users have voted for Masters Council
//         getPhDUsersVoted2Count() // How many users have voted for PhD Council
//       ]).then(([voteCounts, totalUserCount, voted1UserCount, voted2UserCount, ugOrASPUsersVoted2Count,MSCorMAUsersVoted2Count,PhDUsersVoted2Count]) => {
//         res.render('res', {
//           voteCounts: voteCounts,
//           totalUserCount: totalUserCount,
//           voted1UserCount: voted1UserCount,
//           voted2UserCount: voted2UserCount,
//           ugOrASPUsersVoted2Count: ugOrASPUsersVoted2Count,
//           MSCorMAUsersVoted2Count:MSCorMAUsersVoted2Count,
//           PhDUsersVoted2Count:PhDUsersVoted2Count
//         });
//       }).catch(err => {
//         console.error('Error:', err);
//       });
//       }else{
//         res.sendStatus(404);
//       }
// });


app.get("/re-summary", function(req,res){
  if(req.query.key==111222333 && req.query.toy==333222111){
    const getTotalUserCount = () => {
      return User.countDocuments().then(count => {
        return count;
      }).catch(err => {
        console.error('Error counting total users:', err);
        throw err;
      });
    };

    const getVoted1UserCount = () => {
      return User.countDocuments({ voted1: true }).then(count => {
        return count;
      }).catch(err => {
        console.error('Error counting users who voted in presidential election:', err);
        throw err;
      });
    };
    // Driver code
    Promise.all([
      getTotalUserCount(), // Total users on the site
      getVoted1UserCount(), // how many users have voted for presidential elections
    ]).then(([totalUserCount, voted1UserCount]) => {
      res.render('re-res', {
        totalUserCount: totalUserCount,
        voted1UserCount: voted1UserCount,
      });
    }).catch(err => {
      console.error('Error:', err);
    });
    }else{
      res.sendStatus(404);
    }
});

app.get("/results", async function(req, res) {
    const getVoteCount = async (candidateName, candidateUuid, type) => {
      try {
        const count = await Vote.countDocuments({ identifier: candidateUuid });
        return [type, candidateName, count];
      } catch (error) {
        console.error('Error getting vote count:', error);
        return [type, candidateName, 0]; // Return 0 if there's an error
      }
    };

    var presidentCandidates = JSON.parse(fs.readFileSync("re-president.json"));
    var finalArray = [];

    // Collect promises from all async calls
    const promises = [];

    presidentCandidates.forEach(candidate => {
      promises.push(getVoteCount(candidate.name, candidate.uuid, "PRESIDENT"));
    });
    promises.push(getVoteCount("NOTA", "4ba36c5f-9f7e-466b-ad52-d8c46f09b01e", "PRESIDENT"));

    // Wait for all promises to resolve
    finalArray = await Promise.all(promises);
    
    // Log finalArray

    // Respond with finalArray

  // Sort the final array by vote count in descending order
  finalArray.sort((a, b) => b[2] - a[2]);
  console.log(finalArray);

  // Render the HTML template with the final array data
  res.render('final-re-results', {
    array:finalArray
  });
});

app.get("/auth/google", passport.authenticate("google", { hd: 'ashoka.edu.in', scope: ["profile", "email"] }));

app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/" }), (req, res) => {
  User.findOne({ email: req.user._json.email })
  .then(existingUser => {
    if (existingUser) {
      console.log("User already exists");
      // Handle the case where the user already exists
    } else {
      // Create a new user
      const newUser = new User({
        name: req.user._json.name,
        email: req.user._json.email,
        voted1: false,
        voted2: false,
        opened1: 0,
        opened2: 0,
        suspicious: false
      });

      // Save the new user
      newUser.save()
        .then(savedUser => {
          console.log("User created successfully:", savedUser);
          // Handle the success case
        })
        .catch(error => {
          console.error("Error creating user:", error);
          // Handle the error case
        });
    }
  })
  .catch(error => {
    console.error("Error checking existing user:", error);
    // Handle the error case
  });

    res.redirect("/");
});

app.get("/logout", (req, res) => {
  req.logout(function(err){
    if(err){
        console.log(err);
    }else{
        req.session.destroy((err) => {
            if (err) {
              console.error("Error destroying session:", err);
            }
            res.clearCookie("connect.sid");
            res.redirect("/");
          });
    }
  });
});

app.get("*", (req, res) => {
  res.send("Error 404");
});

app.listen(port, () => {
  console.log("Listening on port " + port);
});