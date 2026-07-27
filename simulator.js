class point {
    //コンストラクタ
    constructor(x,y) {
        this.x = x;
        this.y = y;
    }
    add(otherVector){
        return new point(this.x+otherVector.x,this.y+otherVector.y);
    }
    sub(otherVector){
        return new point(this.x-otherVector.x,this.y-otherVector.y);
    }
    times(otherVector){
        return new point(this.x*otherVector.x,this.y*otherVector.y);
    }
    squared(){
        return new point(this.x*this.x,this.y*this.y);
    }
    times_float(float){
        return new point(this.x*float, this.y*float);
    }
    x_add_y(){
        return this.x+this.y;
    }
    cross(otherVector){
        return this.x * otherVector.y - this.y * otherVector.x;
    }
    dot(otherVector, float){
        return (this.x * otherVector.y + this.y * otherVector.x) - float;
    }
}
class line {
    constructor(p1,p2,color = "black") {
        this.p1 = p1;
        this.p2 = p2;
        this.color = color;
    }
}
const canvas = document.getElementById("input_cp_area");
const slider = document.getElementById("linetype")
const margen = 0.625
const size_x = 512
const size_y = 512
const contxt = canvas.getContext("2d");
const points = [new point(0,0),new point(size_x,0),new point(size_x,size_y),new point(0,size_y)];
const lines = [new line(points[0],points[1]),new line(points[1],points[2]),new line(points[2],points[3]),new line(points[3],points[0])];
let is_select = false;
let fast_point = new point(0,0);
let last_point = new point(0,0);
let new_points = [];
const rad_of_deg = 180 / Math.PI;
const deg_of_rad = Math.PI / 180;
const linetypes = ["black", "red", "blue"];
let linecolor = "black";
draw_all()
canvas.addEventListener('click', add_line, false);
canvas.addEventListener('mousemove', get_direction, false);
slider.addEventListener('input', (e) => {
    linecolor = linetypes[e.target.value];
  });
canvas.addEventListener('dblclick', delete_line, false);
function draw_all(){
    contxt.clearRect(0, 0, size_x, size_y)
    lines.forEach(line => {
        draw_line(line);
        });
    points.forEach(point => {
        drawPoint(point);
    });
    for (let i = 0; i < new_points.length-1; i++) {
            drawPoint(new_points[i]);
        }
}

function drawPoint(point) {
  contxt.beginPath();
  // arc(x, y, 半径, 開始角度, 終了角度)
  contxt.arc(point.x, point.y, 2, 0, Math.PI * 2); 
  contxt.fillStyle = 'red';
  contxt.fill();
}

function draw_line(line) {
    contxt.beginPath();
    contxt.lineWidth = 1;      
    contxt.strokeStyle = line.color;    
    contxt.moveTo(line.p1.x,line.p1.y);          
    contxt.lineTo(line.p2.x,line.p2.y);          
    contxt.stroke();                 
}
function get_direction(e){
    if(is_select){
        new_points.length = 0;
        const rect = canvas.getBoundingClientRect();
        let current_pos = new point(e.clientX-rect.left , e.clientY-rect.top);
        let temp = current_pos.sub(fast_point);
        let radian = Math.atan2(temp.y, temp.x);
        let angel =  radian * rad_of_deg;
        angel = Math.round(angel / 22.5) * 22.5 * deg_of_rad;
        let line_normal = new point(-Math.cos(angel), Math.sin(angel));
        let D = fast_point.dot(line_normal, 0);
        lines.forEach(line => {
            add_new_point__ray_segment_Intersection(D, line_normal, line);
        });
        draw_all();
    };
}
function add_new_point__ray_segment_Intersection(D, line_normal, line) {
    let D1 = line.p1.dot(line_normal, D);
    let D2 = line.p2.dot(line_normal, D);
    if(D1 * D2 <= 0){
        let t = D1/(D1-D2);
        new_points.push(line.p1.add(line.p2.sub(line.p1).times_float(t)));
    };
}
function add_new_line(startline) {
    const stack = [startline];
    while (stack.length > 0){
        const newline = stack.pop();
        const ab1 = newline.p2.sub(newline.p1);
        let is_stack = false;
        lines.forEach(line2 => {
            const ab2 = line2.p2.sub(line2.p1);
            if (ab1.cross(line2.p1.sub(newline.p1)) * ab1.cross(line2.p2.sub(newline.p1)) < 0 && ab2.cross(newline.p1.sub(line2.p1)) * ab2.cross(newline.p2.sub(line2.p1)) < 0){
                const line_normal = new point(ab2.x, -ab2.y);
                const D = line2.p1.dot(line_normal, 0)
                let D1 = newline.p1.dot(line_normal, D);
                let D2 = newline.p2.dot(line_normal, D);
                if ((D1 < -1 && D2 > 1) || (D1 > 1 && D2 < -1)){
                    let t = D1/(D1-D2);
                    if(0 < t && t < 1){
                        let p = newline.p1.add(newline.p2.sub(newline.p1).times_float(t));
                        let near_point = null;
                        points.forEach(v => {
                            if(Math.sqrt(v.sub(p).squared().x_add_y())<margen*10){
                                near_point = v;
                            };
                        });
                        if(near_point == null){
                            points.push(p);
                        }
                        else{
                            p = near_point;
                        };
                        stack.push(new line(newline.p1, p, newline.color));
                        stack.push(new line(p, newline.p2, newline.color));
                        is_stack = true
                        return;
                    };
                };
            };
        });
        if (is_stack == false){
            lines.push(newline);
        };
    };
}
function add_line(e){
    if(is_select){
        last_point = get_near_new_point(e);
        if(last_point != null){
            points.push(last_point);
            add_new_line(new line(fast_point, last_point, linecolor));
            new_points.length = 0;
            draw_all()
        };
        is_select = false;
    }
    else{
        fast_point = get_near_point(e);
        if (fast_point != null){
            is_select = true;
        };
    };
}
function delete_line(e){
    const rect = canvas.getBoundingClientRect();
    let mousepoint = new point(e.clientX - rect.left, e.clientY - rect.top);
    let mouse_near_line = null
    lines.forEach(line => {
        let line_dir = new point(line.p1.x - line.p2.x, line.p1.y - line.p2.y);
        let D = mousepoint.dot(line_dir, 0);
        let D1 = line.p1.dot(line_dir, D);
        let D2 = line.p2.dot(line_dir, D);
        let t = D1 / (D1 - D2);
        if (0 < t && t < 1) {
            let p = line.p1.add(line.p2.sub(line.p1).times_float(t));
            if (Math.sqrt(p.sub(mousepoint).squared().x_add_y()) < margen * 10) {
                    mouse_near_line = line;
            };
        };
    });
    if (mouse_near_line != null) {
        const index = lines.indexOf(mouse_near_line);
        if (index > -1) {
            lines.splice(index, 1);
        }
        draw_all()
    }
}
function get_near_new_point(e){
    const rect = canvas.getBoundingClientRect();
    let mousepoint = new point(e.clientX - rect.left, e.clientY - rect.top);
    let mouse_near_point = null
    new_points.forEach(p => {
        if(Math.sqrt(p.sub(mousepoint).squared().x_add_y()) < margen*10){
            mouse_near_point = p;
        };
    });
    return mouse_near_point;
}
function get_near_point(e){
    const rect = canvas.getBoundingClientRect();
    let mousepoint = new point(e.clientX - rect.left, e.clientY - rect.top);
    let mouse_near_point = null
    points.forEach(p => {
        if(Math.sqrt(p.sub(mousepoint).squared().x_add_y()) < margen*10){
            mouse_near_point = p;
        };
    });
    return mouse_near_point;
}
