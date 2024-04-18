// Import required Node.js modules and external packages
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

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

app.get("/vote", (req, res) => {
    if (req.isAuthenticated()) {
      // If user is authenticated, show "logged in" message
      User.findOne({ email: req.user._json.email})
            .then(user => {
                var voted1=user.voted1;
                var voted2=user.voted2;
                var opened1Twice=user.opened1<2?false:true;
                var opened2Twice=user.opened2<2?false:true;
                res.render("voting",{user:req.user._json,voted1:voted1,voted2:voted2,opened1Twice:opened1Twice,opened2Twice:opened2Twice});
            })
            .catch(err => {
                console.error("Error finding user:", err);
        });
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
  });

app.get("/vote/president", (req, res) => {
    if (req.isAuthenticated()) {
        if(req.user._json.email.includes("_")){
            // If user is authenticated, show "logged in" message
            var pairs=JSON.parse(fs.readFileSync("president.json"));
            User.findOne({ email: req.user._json.email})
            .then(user => {
                if(user.voted1){
                    res.send("You have already voted.");
                }else{
                    if (user.opened1<2) {
                        res.render("president",{user:req.user._json,council:pairs,allowed:1});
                    } else {
                        res.send("You've opened this page " +user.opened1+" times, hence quarantined. Please contact the developers at ibrahim.khalil_ug25@ashoka.edu.in.")
                    }
                }
            })
            .catch(err => {
                console.error("Error finding user:", err);
            });

            User.findOneAndUpdate({ email: req.user._json.email }, { $inc: { opened1: 1 } }, { new: true })
            .then(updatedUser => {
                if (updatedUser) {
                console.log("User updated successfully:", updatedUser);
                } else {
                console.log("User not found.");
                }
            })
            .catch(err => {
                console.error("Error updating user:", err);
            });
        }else{
            res.send("Only students allowed to vote!")
        }
      } else {
        // If user is not authenticated, redirect to Google OAuth authentication
        res.redirect("/auth/google");
      }
});

app.get("/vote/ug-council", (req, res) => {
    if (req.isAuthenticated()) {
      // If user is authenticated, show "logged in" message
      if(req.user._json.email.includes("_ug")){
        var ugCouncil=JSON.parse(fs.readFileSync("ug-council.json"));
        User.findOne({ email: req.user._json.email})
        .then(user => {
            if(user.voted2){
                res.send("You have already voted.");
            }else{
                if (user.opened2<2) {
                    res.render("ug",{user:req.user._json,council:ugCouncil,allowed:15});
                } else {
                    res.send("You've opened this page " +user.opened2+" times. Please contact the developers at ibrahim.khalil_ug25@ashoka.edu.in.")
                }
            }
        })
        .catch(err => {
            console.error("Error finding user:", err);
        });

        User.findOneAndUpdate({ email: req.user._json.email }, { $inc: { opened2: 1 } }, { new: true })
            .then(updatedUser => {
                if (updatedUser) {
                console.log("User updated successfully:", updatedUser);
                } else {
                console.log("User not found.");
                }
            })
            .catch(err => {
                console.error("Error updating user:", err);
            });
      }else{
        res.sendStatus(404);
      }
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
  });

app.get("/vote/masters-council", (req, res) => {
    if (req.isAuthenticated()) {
      // If user is authenticated, show "logged in" message
      if(req.user._json.email.includes("_ma") || req.user._json.email.includes("_msc")){
        var mastersCouncil=JSON.parse(fs.readFileSync("masters-council.json"));
        User.findOne({ email: req.user._json.email})
        .then(user => {
            if(user.voted2){
                res.send("You have already voted.");
            }else{
                if (user.opened2<2) {
                    res.render("masters",{user:req.user._json,council:mastersCouncil,allowed:2});
                } else {
                    res.send("You've opened this page" +user.opened2+" times. Please contact the developers at ibrahim.khalil_ug25@ashoka.edu.in.")
                }
            }
        })
        .catch(err => {
            console.error("Error finding user:", err);
        });
        
        User.findOneAndUpdate({ email: req.user._json.email }, { $inc: { opened2: 1 } }, { new: true })
            .then(updatedUser => {
                if (updatedUser) {
                console.log("User updated successfully:", updatedUser);
                } else {
                console.log("User not found.");
                }
            })
            .catch(err => {
                console.error("Error updating user:", err);
            });
      }else{
        res.sendStatus(404);
      }
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
  });

app.get("/vote/phd-council", (req, res) => {
    if (req.isAuthenticated()) {
      // If user is authenticated, show "logged in" message
      if(req.user._json.email.includes("_phd")){
        var phdCouncil=JSON.parse(fs.readFileSync("phd-council.json"));
        User.findOne({ email: req.user._json.email})
        .then(user => {
            if(user.voted2){
                res.send("You have already voted.");
            }else{
                if (user.opened2<2) {
                    res.render("phd",{user:req.user._json,council:phdCouncil,allowed:2});
                } else {
                    res.send("You've opened this page" +user.opened2+" times. Please contact the developers at ibrahim.khalil_ug25@ashoka.edu.in.")
                }
            }
        })
        .catch(err => {
            console.error("Error finding user:", err);
        });
        
        User.findOneAndUpdate({ email: req.user._json.email }, { $inc: { opened2: 1 } }, { new: true })
            .then(updatedUser => {
                if (updatedUser) {
                console.log("User updated successfully:", updatedUser);
                } else {
                console.log("User not found.");
                }
            })
            .catch(err => {
                console.error("Error updating user:", err);
            });
      }else{
        res.sendStatus(404);
      }
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
  });

  app.post("/submit-votes/ug", (req, res) => {
    if (req.isAuthenticated()) {
        if(req.user._json.email.includes("_ug")){
            User.findOne({ email: req.user._json.email})
            .then(user => {
                if (!user.voted2) {
                    var uniqueAffiliations = [...new Set(Object.values(req.body).map(item => item.affiliation))];
                    uniqueAffiliations=uniqueAffiliations.slice(0,15); // maximum of 15 allowed
                    uniqueAffiliations.forEach(affiliation => {
                        // Create a newVote for each unique affiliation
                        fs.readFile('ug-council.json', 'utf8', (err, data) => {
                            if (err) {
                              console.error('Error reading file:', err);
                              return;
                            }
                          
                            var allowedAffiliations = [...new Set(JSON.parse(data).map(obj => obj.uuid))];
                            allowedAffiliations.push("4fe0588e-9bbf-4128-914b-838439288224"); // NOTA id
                            if(allowedAffiliations.includes(affiliation)){
                                const newVote = new Vote({
                                    identifier: affiliation,
                                    type: "UG",
                                    count: 1 // Initial count set to 1
                                });
        
                                // Save the newVote to the database
                                newVote.save().then(() => {
                                    console.log(`New vote created for affiliation: ${affiliation}`);
                                }).catch(err => {
                                    console.error('Error creating new vote:', err);
                                });
                            }else{
                                console.log("No such affiliation for: "+ affiliation);
                            }
                          
                          });
                    });
                    
                    User.findOneAndUpdate({ email: req.user._json.email }, { voted2:true })
                        .then(updatedUser => {
                            if (updatedUser) {
                            console.log("User updated successfully:", updatedUser);
                            } else {
                            console.log("User not found.");
                            }
                        })
                        .catch(err => {
                            console.error("Error updating user:", err);
                        });
                    res.send("Your vote was registered. Thank you for your time.")
                } else {
                    res.send("Your vote is already registered. Contact ibrahim.khalil_ug25@ashoka.edu.in in case you feel this is an error.")
                }
            })
            .catch(err => {
                console.error("Error finding user:", err);
            });
        }else{
            res.send("Not an eligible student.");
        }
      console.log(req.body);
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
  });
  

  app.post("/submit-votes/masters", (req, res) => {
    if (req.isAuthenticated()) {
        if(req.user._json.email.includes("_ma") || req.user._json.email.includes("_msc")){
            User.findOne({ email: req.user._json.email})
            .then(user => {
                if (!user.voted2) {
                    var uniqueAffiliations = [...new Set(Object.values(req.body).map(item => item.affiliation))];
                    uniqueAffiliations=uniqueAffiliations.slice(0,2); // maximum of 2 allowed
                    uniqueAffiliations.forEach(affiliation => {
                        fs.readFile('masters-council.json', 'utf8', (err, data) => {
                            if (err) {
                              console.error('Error reading file:', err);
                              return;
                            }
                          
                            var allowedAffiliations = [...new Set(JSON.parse(data).map(obj => obj.uuid))];
                            allowedAffiliations.push("ef0b976e-c1c0-4e4c-a015-0cf81ac47fd3"); // NOTA id
                            if(allowedAffiliations.includes(affiliation)){
                                const newVote = new Vote({
                                    identifier: affiliation,
                                    type: "MASTERS",
                                    count: 1 // Initial count set to 1
                                });
        
                                // Save the newVote to the database
                                newVote.save().then(() => {
                                    console.log(`New vote created for affiliation: ${affiliation}`);
                                }).catch(err => {
                                    console.error('Error creating new vote:', err);
                                });
                            }else{
                                console.log("No such affiliation for: "+ affiliation);
                            }
                          
                          });
                    });
                    
                    User.findOneAndUpdate({ email: req.user._json.email }, { voted2:true })
                        .then(updatedUser => {
                            if (updatedUser) {
                            console.log("User updated successfully:", updatedUser);
                            } else {
                            console.log("User not found.");
                            }
                        })
                        .catch(err => {
                            console.error("Error updating user:", err);
                        });
                    res.send("Your vote was registered. Thank you for your time.")
                } else {
                    res.send("Your vote is already registered. Contact ibrahim.khalil_ug25@ashoka.edu.in in case you feel this is an error.")
                }
            })
            .catch(err => {
                console.error("Error finding user:", err);
            });
        }else{
            res.send("Not an eligible student.");
        }
      console.log(req.body);
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
  });


  app.post("/submit-votes/phd", (req, res) => {
    if (req.isAuthenticated()) {
        if(req.user._json.email.includes("_phd")){
            User.findOne({ email: req.user._json.email})
            .then(user => {
                if (!user.voted2) {
                    var uniqueAffiliations = [...new Set(Object.values(req.body).map(item => item.affiliation))];
                    uniqueAffiliations=uniqueAffiliations.slice(0,2); // maximum of 2 allowed
                    uniqueAffiliations.forEach(affiliation => {
                        fs.readFile('phd-council.json', 'utf8', (err, data) => {
                            if (err) {
                              console.error('Error reading file:', err);
                              return;
                            }
                          
                            var allowedAffiliations = [...new Set(JSON.parse(data).map(obj => obj.uuid))];
                            allowedAffiliations.push("de83a521-3d47-4671-b49d-2cd4feeb98b4"); // NOTA id
                            if(allowedAffiliations.includes(affiliation)){
                                const newVote = new Vote({
                                    identifier: affiliation,
                                    type: "PHD",
                                    count: 1 // Initial count set to 1
                                });
        
                                // Save the newVote to the database
                                newVote.save().then(() => {
                                    console.log(`New vote created for affiliation: ${affiliation}`);
                                }).catch(err => {
                                    console.error('Error creating new vote:', err);
                                });
                            }else{
                                console.log("No such affiliation for: "+ affiliation);
                            }
                          
                          });
                    });
                    
                    User.findOneAndUpdate({ email: req.user._json.email }, { voted2:true })
                        .then(updatedUser => {
                            if (updatedUser) {
                            console.log("User updated successfully:", updatedUser);
                            } else {
                            console.log("User not found.");
                            }
                        })
                        .catch(err => {
                            console.error("Error updating user:", err);
                        });
                    res.send("Your vote was registered. Thank you for your time.")
                } else {
                    res.send("Your vote is already registered. Contact ibrahim.khalil_ug25@ashoka.edu.in in case you feel this is an error.")
                }
            })
            .catch(err => {
                console.error("Error finding user:", err);
            });
        }else{
            res.send("Not an eligible student.");
        }
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
  });


  app.post("/submit-votes/president", (req, res) => {
    if (req.isAuthenticated()) {
        if(req.user._json.email.includes("_")){
            User.findOne({ email: req.user._json.email})
            .then(user => {
                if (!user.voted1) {
                    var uniqueAffiliations = [...new Set(Object.values(req.body).map(item => item.affiliation))];
                    uniqueAffiliations=uniqueAffiliations.slice(0,1); // maximum of 1 allowed
                    uniqueAffiliations.forEach(affiliation => {
                        fs.readFile('president.json', 'utf8', (err, data) => {
                            if (err) {
                              console.error('Error reading file:', err);
                              return;
                            }
                          
                            var allowedAffiliations = [...new Set(JSON.parse(data).map(obj => obj.uuid))];
                            allowedAffiliations.push("c1b383d6-0534-4f47-8c18-ec4212fd0e8a"); // NOTA id
                            if(allowedAffiliations.includes(affiliation)){
                                const newVote = new Vote({
                                    identifier: affiliation,
                                    type: "PRESIDENT",
                                    count: 1 // Initial count set to 1
                                });
        
                                // Save the newVote to the database
                                newVote.save().then(() => {
                                    console.log(`New vote created for affiliation: ${affiliation}`);
                                }).catch(err => {
                                    console.error('Error creating new vote:', err);
                                });
                            }else{
                                console.log("No such affiliation for: "+ affiliation);
                            }
                          
                          });
                    });
                    
                    User.findOneAndUpdate({ email: req.user._json.email }, { voted1:true })
                        .then(updatedUser => {
                            if (updatedUser) {
                            console.log("User updated successfully:", updatedUser);
                            } else {
                            console.log("User not found.");
                            }
                        })
                        .catch(err => {
                            console.error("Error updating user:", err);
                        });
                    res.send("Your vote was registered. Thank you for your time.")
                } else {
                    res.send("Your vote is already registered. Contact ibrahim.khalil_ug25@ashoka.edu.in in case you feel this is an error.")
                }
            })
            .catch(err => {
                console.error("Error finding user:", err);
            });
        }else{
            res.send("Not an eligible student.");
        }
      console.log(req.body);
    } else {
      // If user is not authenticated, redirect to Google OAuth authentication
      res.redirect("/auth/google");
    }
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
