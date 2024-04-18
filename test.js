const fs = require('fs');

// Read the JSON file
fs.readFile('phd-council.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  try {
    // Parse the JSON data into an array of objects
    let jsonArray = JSON.parse(data);

    // Sort the array of objects based on the "name" attribute
    jsonArray.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    // Convert the sorted array back to JSON
    let sortedJson = JSON.stringify(jsonArray, null, 2);

    // Write the sorted JSON back to the file
    fs.writeFile('phd-council.json', sortedJson, 'utf8', (err) => {
      if (err) {
        console.error('Error writing file:', err);
        return;
      }
      console.log('File sorted and saved successfully.');
    });
  } catch (error) {
    console.error('Error parsing JSON:', error);
  }
});