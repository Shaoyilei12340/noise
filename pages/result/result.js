Page({
  onReady: function() {
    const query = wx.createSelectorQuery()
    query.select('#myCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')

        const dpr = wx.getWindowInfo().pixelRatio
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        ctx.scale(dpr, dpr)

        ctx.fillRect(0, 0, 100, 100)
      });
  },


  
});
function draw(dataArray) {
  let bufferLength = Uint8Array.length;
  ctx.fillStyle = 'rgb(200, 200, 200)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgb(0, 0, 0)';

  var sliceWidth = WIDTH * 1.0 / bufferLength;
  var x = 0;

  ctx.beginPath();
  for(var i = 0; i < bufferLength; i++) {
    let v = dataArray[i]/128.0,
        y = v * HEIGHT/2;

    if(i === 0)
      ctx.moveTo(x, y);
    else
      ctx.lineTo(x, y);

    x += sliceWidth;
  }

  ctx.lineTo(canvas.width, canvas.height/2);
  ctx.stroke();

};
