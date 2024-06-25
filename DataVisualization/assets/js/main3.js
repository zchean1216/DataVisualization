// Generate a unique ID using a combination of the provided name and a random string
function uid(name) {
    return `${name}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Function to convert CSV data to hierarchical JSON and sum up the years
  function csvToTree(csvData) {
    // Initialize root node with name "Region"
    const root = { name: "Region", children: [] };
  
    // Iterate through each row of the CSV data
    csvData.forEach(row => {
        const { location_name, cause_of_mortality, rate } = row; // Destructure row data
        const path = `${location_name}/${cause_of_mortality}`; // Create a path from location and cause
        const value = +rate; // Convert rate to a number
        const pathParts = path.split('/'); // Split the path into parts
  
        let currentLevel = root; // Start from the root
        pathParts.forEach((name, i) => {
            // Find or create the node for the current path part
            let node = currentLevel.children.find(child => child.name === name);
            if (!node) {
                node = { name, children: [] }; // Create new node if not found
                currentLevel.children.push(node);
            }
            currentLevel = node; // Move to the next level
            
            // If it's the last part of the path, update the value
            if (i === pathParts.length - 1) {
                if (!currentLevel.value) {
                    currentLevel.value = 0; // Initialize value if not set
                }
                currentLevel.value += value; // Sum the values
                currentLevel.children = undefined; // Mark as leaf node
            }
        });
    });
    return root; // Return the root node
  }
  
  // Function to create a color scale based on the rank of the current node values
  function createColorScale(node) {
    // Extract values from the node's children or use the node's value
    const values = node.children ? node.children.map(d => d.value) : [node.value];
    const purpleColors = [
        "#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f" // Predefined array of purple colors
    ];
    const scale = d3.scaleQuantize()
        .domain([Math.min(...values), Math.max(...values)]) 
        .range(purpleColors); 
    return scale;
  }
  
  // Define the chart function to render the zoomable treemap
  function chart(data) {
    const width = window.innerWidth; 
    const height = window.innerHeight / 1.2; // Set height to reduce scrolling
  
    // Custom tile function for treemap layout
    function tile(node, x0, y0, x1, y1) {
        d3.treemapBinary(node, 0, 0, width, height); // Apply binary treemap layout
        for (const child of node.children) {
            // Scale child positions to fit within the parent node
            child.x0 = x0 + child.x0 / width * (x1 - x0);
            child.x1 = x0 + child.x1 / width * (x1 - x0);
            child.y0 = y0 + child.y0 / height * (y1 - y0);
            child.y1 = y0 + child.y1 / height * (y1 - y0);
        }
    }
  
    // Create a hierarchy from the data and sort nodes by value
    const hierarchy = d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
    const root = d3.treemap().tile(tile)(hierarchy);
  
    const x = d3.scaleLinear().rangeRound([0, width]);
    const y = d3.scaleLinear().rangeRound([0, height]);
  
    const format = d3.format(",d");
    const name = d => d.ancestors().reverse().map(d => d.data.name).join("/");
  
    // Create the SVG container
    const svg = d3.create("svg")
        .attr("viewBox", [0.5, -30.5, width, height + 30])
        .attr("width", width)
        .attr("height", height + 30)
        .attr("style", "max-width: 100%; height: auto;")
        .style("font", "10px sans-serif");
  
    // Append a group element and render the treemap
    let group = svg.append("g").call(render, root);
  
    // Function to create background rectangles for text labels
    function addBackgroundRectangles(node) {
        setTimeout(() => {
            node.each(function (d) {
                if (d !== root) {
                    const g = d3.select(this);
                    const text = g.select("text");
                    const bbox = text.node().getBBox();
                    g.insert("rect", "text")
                        .attr("x", bbox.x - 2)
                        .attr("y", bbox.y - 2)
                        .attr("width", bbox.width + 6)
                        .attr("height", bbox.height + 6)
                        .attr("fill", "#f1eef6")
                        .attr("rx", 5) 
                        .attr("ry", 5) 
                        .attr("opacity", 0.8); 
                }
            });
        }, 0); // Delay to ensure DOM update
    }
  
    // Render function for the treemap
    function render(group, root) {
        const color = createColorScale(root); // Create color scale for the root
  
        const node = group
            .selectAll("g")
            .data(root.children.concat(root))
            .join("g");
  
        // Add click interaction for zooming in and out
        node.filter(d => d === root ? d.parent : d.children)
            .attr("cursor", "pointer")
            .on("click", (event, d) => d === root ? zoomout(root) : zoomin(d));
  
        // Add titles for tooltips
        node.append("title")
            .text(d => `${name(d)}\n${format(d.value)}`);
  
        // Add rectangles for the treemap nodes
        node.append("rect")
            .attr("id", d => (d.leafUid = uid("leaf")).id)
            .attr("fill", d => d === root ? "#fff" : color(d.value)) // Set fill color
            .attr("stroke", "#fff")
            .attr("stroke-width", 2); 
  
        // Add clipping paths
        node.append("clipPath")
            .attr("id", d => (d.clipUid = uid("clip")).id)
            .append("use")
            .attr("xlink:href", d => `#${d.leafUid}`);
  
        // Add text labels
        const text = node.append("text")
            .attr("clip-path", d => `url(#${d.clipUid})`)
            .attr("font-weight", d => d === root ? "bold" : null)
            .attr("x", 10)
            .attr("y", 25) // Adjust text position
            .selectAll("tspan")
            .data(d => d === root ? [name(d)] : [d.data.name, format(d.value)]) // Adjust to include name and value
            .join("tspan")
            .attr("class", (d, i, nodes) => i === nodes.length - 1 ? 'treemap-value' : 'treemap-label') // Add classes for styling
            .attr("x", 10)
            .attr("dy", (d, i) => i === 0 ? "0em" : "1.2em") // Adjust vertical spacing
            .text(d => d);
  
        // Call the function to add background rectangles after text is rendered
        addBackgroundRectangles(node);
  
        group.call(position, root); // Call position function to place nodes
    }
  
    // Position function for treemap nodes
    function position(group, root) {
        group.selectAll("g")
            .attr("transform", d => d === root ? `translate(0,-30)` : `translate(${x(d.x0)},${y(d.y0)})`)
            .select("rect")
            .attr("width", d => d === root ? width : x(d.x1) - x(d.x0))
            .attr("height", d => d === root ? 30 : y(d.y1) - y(d.y0));
    }
  
    // Zoom in function
    function zoomin(d) {
        const group0 = group.attr("pointer-events", "none");
        const group1 = group = svg.append("g").call(render, d);
  
        x.domain([d.x0, d.x1]);
        y.domain([d.y0, d.y1]);
  
        svg.transition()
            .duration(750)
            .call(t => group0.transition(t).remove()
                .call(position, d.parent))
            .call(t => group1.transition(t)
                .attrTween("opacity", () => d3.interpolate(0, 1))
                .call(position, d));
    }
  
    // Zoom out function
    function zoomout(d) {
        const group0 = group.attr("pointer-events", "none");
        const group1 = group = svg.insert("g", "*").call(render, d.parent);
  
        x.domain([d.parent.x0, d.parent.x1]);
        y.domain([d.parent.y0, d.parent.y1]);
  
        svg.transition()
            .duration(750)
            .call(t => group0.transition(t).remove()
                .attrTween("opacity", () => d3.interpolate(1, 0))
                .call(position, d))
            .call(t => group1.transition(t)
                .call(position, d.parent));
    }
  
    return svg.node();
  }
  
  // Fetch CSV data, convert to JSON, and render chart
  d3.csv("data3.csv").then(csvData => {
    const data = csvToTree(csvData);
    const svg = chart(data);
    document.getElementById('treemap').appendChild(svg);
  }).catch(error => console.error('Error loading or parsing data:', error));
  
