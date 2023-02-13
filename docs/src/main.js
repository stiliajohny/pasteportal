const searchParams = new URLSearchParams(window.location.search);
const id = searchParams.get('id');

const pasteportalUrl = 'https://api.pasteportal.info/get-paste?id=';
const pasteportalApiKey = 'qVP1XsKWJF2vud7zo1jzS6BQ22xy4xXH4DY634py';
const headers = {
  "x-api-key": pasteportalApiKey
};
const introParagraph = `Welcome to Paste Portal!

Paste Portal is a free, open-source, and user-friendly online copy-paste service.

It appears that you have not provided a valid ID. Please revisit us with a valid ID!
https://pasteportal.info?id=2ba4f3


--

How to use it:

Download the VSCode Extension and use the Command pallet, Sidebar or Shortcut

---

A brief overview of how PastePortal was created (shout out for the prompt @craigmillerdev):

Once upon a time, I was tasked with creating a technical challenge for a job candidate, one that would involve building a service for posting and retrieving messages using their preferred tech stack.
I wanted to see how the candidate would approach the problem and come up with a solution. This led to the development of PastePortal.
In addition, you can enhance your experience by downloading the PastePortal VSCode extension, which allows you to access PastePortal directly from your code editor!

https://marketplace.visualstudio.com/items?itemName=JohnStilia.pasteportal

---
`;



// Get the elements
const sidePanel = document.querySelector('.side-panel');
const text_Area = document.getElementById("text-area");
const toggleIcon = document.querySelector('.toggle-icon');
var modal = document.getElementById("myModal");
var btn = document.getElementById("getPaste");
var span = document.getElementsByClassName("close")[0];


// Add event listener to toggle icon
toggleIcon.addEventListener('click', function () {
  sidePanel.classList.toggle('open');
  text_Area.classList.toggle('open');
});




// check if there is an id in the url
if (id) {
  console.log("Paste ID detected in URL: ", id);
  // do fetch request
  getResponse();
} else {
  document.getElementById("text-area").value = introParagraph;

  // append the random joke
  randomJoke().then(joke => {
    document.getElementById("text-area").value += "\n\n" + joke;
  });
  console.error("The 'id' URL parameter is not present.");
}
async function randonLoadingJoke() {
  const messages = [
    "Hang on tight, we're fetching the info like a dog with a chew toy... Woof!",
    "Just a sec, bossing the servers around... Hang tight!",
    "Brewing up some fresh data, almost ready... hold please!",
    "Data dwarves are mining for information, almost there... Brace yourself!",
    "The info is on its way, like a superhero to save the day... Standby!",
    "Retrieving the goods, like a thief in the night... Just a moment!"
  ];

  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

async function randomJoke() {
  try {
    const response = await fetch("https://icanhazdadjoke.com/", {
      headers: {
        "Accept": "application/json"
      }
    });
    const data = await response.json();
    return data.joke;
  } catch (error) {
    console.error("There has been a problem with your fetch operation:", error);
    return "I'm sorry, I couldn't find a joke for you :(";
  }
}

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    console.log('Text copied to clipboard successfully!');
    return true
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false
  }
}

async function notificationWindowSuccess(text) {
  // Show the notification window with the message "Copied to clipboard"
  const notificationWindow = document.createElement("div");
  notificationWindow.innerHTML = text;
  notificationWindow.classList.add("notification-window-success");
  document.body.appendChild(notificationWindow);

  // Hide the notification window after 2 seconds
  setTimeout(() => {
    notificationWindow.style.display = "none";
  }, 2000);

}

async function notificationWindowError(text) {
  // Show the notification window with the message "Copied to clipboard"
  const notificationWindow = document.createElement("div");
  notificationWindow.innerHTML = text;
  notificationWindow.classList.add("notification-window-error");
  document.body.appendChild(notificationWindow);

  // Hide the notification window after 2 seconds
  setTimeout(() => {
    notificationWindow.style.display = "none";
  }, 100);

}




async function getResponse(id) {
  console.log("getResponse() called");
  id = id || searchParams.get('id');
  try {
    randonLoadingJoke().then(joke => {
      document.getElementById("text-area").value = joke;
    });
    // sleep for 2 seconds
    await new Promise(r => setTimeout(r, 1500));

    const response = await fetch(pasteportalUrl + id, {
      headers
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    const paste = data.response.paste;
    // input the data to the item with id "text-area"
    document.getElementById("text-area").value = paste;
    try {
      copyToClipboard(paste);
      notificationWindowSuccess("Copied to clipboard");
    } catch (error) {
      notificationWindowError("Error: " + error);
      console.error("There has been a problem with Clipboard:", error);
    }
    return data;

  } catch (error) {
    notificationWindowError("Error: " + error);
    console.error("There has been a problem with your fetch operation:", error);
  }
}

var submitPasteIdBtn = document.getElementById("submitPasteId");

// Hide the modal when the page loads
modal.style.display = "none";

// When the user clicks the button, open the modal
btn.onclick = function () {
  modal.style.display = "block";
}

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

submitPasteIdBtn.addEventListener("click", function () {
  var pasteId = document.getElementById("pasteId").value;
  console.log(pasteId);
  // clear the text area
  document.getElementById("pasteId").value = "";
  modal.style.display = "none"
  getResponse(pasteId);
});