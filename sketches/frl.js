function() {
   this.label = "frl";
   this.is3D = true;
   //this.frl = new FRL();

   // this.onSwipe[0] = ['walk'        , function() { this.bird.turnOnWalk(); }];
   // this.onSwipe[1] = ['toggle\ngaze', function() { this.bird.toggleGaze(); }];
   // this.onSwipe[2] = ['toggle\ngaze', function() { this.bird.toggleGaze(); }];
   // this.onSwipe[4] = ['come\nalive' , function() { this.bird.turnOnIdle(); }];

   this.render = function(elapsed) {
      var light = this.getInValue(0, this.light);

      var fsketch = [
         [0,-2,0], [0,0,0], [1,0,0]
      ];

      var rsketch = [
         [0,0,0], [1,-0.5,0], [0,-1,0]
      ];

      var lsketch = [
         [0,0,0], [0,-2,0], [1,-2,0]
      ];

      this.duringSketch(function() {
         lineWidth(1);

         mCurve(fsketch);

         var c = makeSpline(rsketch);
         // var c = arc(0, -0.5, 0.5, PI/2, 3 * PI / 2);
         c.push([1,-2,0]);
         mCurve(c);

         mCurve(lsketch);


      });

      this.afterSketch(function() {
         // mCube();
         // if (! this.ctObject) {
         //       this.ctObject = new CT.Node();
         //       ctScene.add(this.ctObject);
         // }
         // var mycube = new CT.Cube();
         // mycube.scale(0.2,0.2,0.2);
         // this.ctObject.add(mycube);

         // this.ctObject.draw();
         // mBox(0.5,0.3);
         // window.mTorus();
         // window.mCube();
         m.save();
         m.scale(0.5,0.5,0.5);
         m.rotateY(PI/4);
         m.translate(0.5,0,0);
         mSquare();
         m.restore();

         m.save();
         m.rotateY(-PI/4);
         m.scale(0.5,0.5,0.5);
         m.translate(-0.5,0,0);
         mSquare();
         m.restore();
      });

      //this.afterSketch(function() {
         // color(palette.color[this.colorId]);
         // mCurve(S);

         // color(fadedColor(mix(.03, 1, pow(light, 3)), this.colorId));
         // mFillCurve(S);

         // lineWidth(1);
         // color(defaultPenColor);
         // mCurve(A);
         // mCurve(B);
      //});

      //lineWidth(1);
      //color(defaultPenColor);
      //mCurve(C);
   }
}