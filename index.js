const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const app = express();
const port = 8000;
const cors = require("cors");
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(passport.initialize());
const jwt = require("jsonwebtoken");

mongoose
  .connect("mongodb+srv://nitin:nitin@cluster0.flbdl.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to mongoDb");
  })
  .catch((error) => {
    console.log("Error connecting database", error);
  });
app.listen(port, () => {
  console.log("Server connected on the port ", port);
});

const User = require("./models/user");
const Message = require("./models/message");

//end point for the registration of the user

app.post("/register", (req, res) => {
  const { name, email, password, image } = req.body;
  //create a new user object
  const newUser = new User({ name, email, password, image });
  //save the user to the database
  newUser
    .save()
    .then(() => {
      res.status(200).json({ message: "User registered successfully" });
    })
    .catch((err) => {
      console.log("Error registering user ", err);
      res.status(500).json({ message: "Error registring the user!" });
    });
});

//function to create token based on user id
const createToken = (userId) => {
  //set the token payload
  const payload = {
    userId: userId,
  };
  //Generate the token with a secret key and expiration time
  const token = jwt.sign(payload, "Q$r2K6W8n!jCW%Zk", { expiresIn: "1h" });
  return token;
};
//end point for logging in for particular user

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  //check if the email or password is provided
  if (!email || !password) {
    return res.status(404).json({ message: "Email and password are required" });
  }
  //check for the user of the databse
  User.findOne({ email })
    .then((user) => {
      if (!user) {
        //user not found
        return res.status(404).json({ message: "User not found" });
      }

      //compare the provided password with the password in the database
      if (user.password !== password) {
        return res.status(404).json({ message: "Invalid password1" });
      }
      const token = createToken(user._id);
      res.status(200).json({ token });
    })
    .catch((error) => {
      console.log("error in finding user", error);
      res.status(500).json({ message: "Internal server error" });
    });
});

//end point to acces all the user except who is currently logged in
app.get("/users/:userId", (req, res) => {
  const loggedInUserId = req.params.userId;
  User.find({ _id: { $ne: loggedInUserId } })
    .then((users) => {
      res.status(200).json(users);
    })
    .catch((err) => {
      console.log("Error retrieving users", err);
      res.status(500).json({ message: "Error retreiving user" });
    });
});

//end point to send a request to a user
app.post("/friend-request", async (req, res) => {
  const { currentUserId, selectedUserId } = req.body;
  try {
    //update the recepients friend request array
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { friendRequest: currentUserId },
    });
    //update the senders send frirnd request array
    await User.findByIdAndUpdate(currentUserId, {
      $push: { sentFriendRequest: selectedUserId },
    });
    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
});

//endpoint to show all the friend request of a pparticular user
app.get("/friend-request/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    //fetch the user document based on the User id
    const user = await User.findById(userId)
      .populate("friendRequest", "name email image")
      .lean();

    const friendRequests = user.friendRequest;
    res.json(friendRequests);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to accept a request of particular person
app.post("/friend-request/accept", async (req, res) => {
  try {
    const { senderId, recepientId } = req.body;
    //retreive the document of sender and the receipient
    const sender = await User.findById(senderId);
    const receipient = await User.findById(recepientId);

    receipient.friends.push(senderId);
    sender.friends.push(recepientId);

    receipient.friendRequest = receipient.friendRequest.filter(
      (request) => request.toString() !== senderId.toString()
    );

    sender.sentFriendRequest = sender.sentFriendRequest.filter(
      (request) => request.toString() !== receipient.toString()
    );
    await sender.save();
    await receipient.save();
    res.status(200).json({ message: "Friend request accepted successfully" });
  } catch (error) {
    console.log("Error", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to access all the friends of logged in users
app.get("/accepted-friends/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate(
      "friends",
      "name email image"
    );
    const acceptedFriends = user.friends;
    res.json(acceptedFriends);
  } catch (error) {
    console.log("Error : ", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
const multer = require("multer");
//configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "files/"); //specify the desired destination folder
  },
  filename: function (req, file, cb) {
    //generate a unique filename for the uploaded file
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });
//end point to post messages and store in backend
app.post("/messages", upload.single("imageFile"), async (req, res) => {
  try {
    const { senderId, recepientId, messageType, messageText } = req.body;
    // if (messageType === "image" && req.file) {
    //   // Process image
    //   const imageUrl = req.file.path; // Path to the uploaded image
    //   // Save imageUrl to your database as needed
    // }

    const newMessage = new Message({
      senderId,
      recepientId,
      messageType,
      message: messageText,
      timestamp: new Date(),
      imageUrl: messageType === "image" ? req.file.path : null,
    });
    await newMessage.save();
    res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    console.log("Error : ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//end point to get the userDetails to design the chat room header

app.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    //fetch the user data from the userID
    const recepientId = await User.findById(userId);

    res.json(recepientId);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//endpoint to fetch the messages between two user in the chatroom
app.get("/messages/:senderId/:recepientId", async (req, res) => {
  try {
    const { senderId, recepientId } = req.params;
    const messages = await Message.find({
      $or: [
        { senderId: senderId, recepientId: recepientId },
        { senderId: recepientId, recepientId: senderId },
      ],
    }).populate("senderId", "_id name");
    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//endpoint to delete the messages!
app.post("/deleteMessages", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Invalid request body!" });
    }
    await Message.deleteMany({ _id: { $in: messages } });
    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.log("Error : ", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/friend-requests/sent/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate("sentFriendRequest", "name email image")
      .lean();
    const sentFriendRequests = user.sentFriendRequest;
    res.json(sentFriendRequests);
  } catch (error) {
    console.log("Error : ", error);
    res.status(500).json({ error: "Internal server " });
  }
});

app.get("/friends/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    User.findById(userId)
      .populate("friends")
      .then((user) => {
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const friendsIds = user.friends.map((friend) => friend._id);
        res.status(200).json(friendsIds);
      });
  } catch (error) {
    console.log("Error : ", error);
    res.status(500).json({ message: "Internal server error" });
  }
});