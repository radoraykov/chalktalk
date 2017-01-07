"use strict";

var Atypical = (function () {
   var AT = {};

   // This internal variable holds all of our types, with keys being their names and values
   // being their constructors.
   var _types = {};

   // This internal variable will hold all our conversion functions, in the following structure:
   // {
   //     typename_converted_from: {
   //         typename_converted_to_1: function(value) {...}
   //         typename_converted_to_2: function(value) {...}
   //         ...
   //     }
   //     ...
   // }
   var _conversions = {};

   var _intermediaryConversionsToAnyDestination = {}; // TODO: DOC
   var _intermediaryConversionsFromAnySource = {}; // TODO: DOC

   // Base for all types. Contains some common functionality needed in all of them.
   AT.Type = function() {};
   AT.Type.prototype = {
      // Converts this object to another type, returning the converted object or undefined
      // if no conversion exists.
      //
      // typename: Name of the destination type. Must be a type name that's already been
      //           defined.
      convert: function(typename) {
         if (!AT.typeIsDefined(typename)) {
            console.error("Type " + typename + " not defined.");
            return undefined;
         }
         if (typename == this.typename) {
            return this;
         }
         var conversionFunction = _conversions[this.typename][typename];
         if (!conversionFunction) {
            return undefined;
         }
         else {
            return conversionFunction(this);
         }
      },
      // Checks whether a conversion function between this object and another type exists.
      //
      // typename: Name of the type you want to convert to. Must be a type name that's already
      //           been defined.
      canConvert: function(typename) {
         return AT.canConvert(this.typename, typename);
      },
      // Helper function for defining an immutable property on this object.
      // Meant to be used primarily in initializers, and not anywhere else.
      //
      // propertyName: A string containing the desired name of the property.
      // value: The value you want it to have. This cannot be changed later.
      _def: function(propertyName, value) {
         if (typeof propertyName !== "string") {
            console.error(
               "Attempted to define a property with non-string name ("+propertyName+")");
            return;
         }
         Object.defineProperty(this, propertyName, {value: value, writeable: false});
      }
   };

   // Checks whether a type with the given name is already defined.
   // 
   // typename: The name of the type you want to check for. Must be a string, if not a string
   //           this function returns false.
   AT.typeIsDefined = function(typename) {
      return typeof(typename) === "string" && _types.hasOwnProperty(typename)
   };

   AT.canConvert = function(sourceTypename, destinationTypename) { // TODO: DOC
      if (!AT.typeIsDefined(sourceTypename)) {
         console.error("Type " + sourceTypename + " not defined.");
         return undefined;
      }
      if (!AT.typeIsDefined(destinationTypename)) {
         console.error("Type " + destinationTypename + " not defined.");
         return undefined;
      }
      if (sourceTypename == destinationTypename) { return true; }
      return (_conversions[sourceTypename][destinationTypename] !== undefined);
   }

   // Internal function to build an Atypical type. Sets up the correct prototype, the
   // required functions, and so on.
   //
   // implementation: An object containing the implementation of the required members and 
   //                 functions for the type. These are:
   //                 typename: A string containing the name of the type. Must be unique and
   //                           follow Javascript identifier syntax.
   //                 init: Initialization function. Should take the same arguments as your
   //                       constructor and handle all initialization logic. Should also do any
   //                       required validation of the arguments and throw a ConstructionError if
   //                       incorrect arguments are provided.
   //                 This object may also contain any other functions and elements that are
   //                 required for this type.
   AT.defineType = function(implementation) {
      if (typeof implementation.init !== "function") {
         console.error("Initialization function is required when creating a new type.");
         return undefined;
      }
      if (typeof implementation.typename !== "string") {
         console.error("Typename string is required when creating a new type.");
         return undefined;
      }
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(implementation.typename)) {
         console.error("Typename must follow Javascript identifier syntax.");
         return undefined;
      }
      if (AT.typeIsDefined(implementation.typename)) {
         console.error("A type with the name " + implementation.typename + " is already defined.");
         return undefined;
      }

      // For reasons I don't entirely understand, doing something like this:
      //
      //     var AtypicalType = function() {
      //         this.init.apply(this, arguments);
      //     }
      //     
      // And then returning AtypicalType at the end of the function, ends up making the
      // Chrome developer tools infer the name of EVERY SINGLE TYPE defined using this
      // function as "AtypicalType", leaving you debugging monstrosities like this in
      // the console:
      // 
      //     AtypicalType {x: AtypicalType, y: AtypicalType, z: AtypicalType}
      //
      // So I'm making a deal with the devil and using "eval" instead. Below, we set 
      // AtypicalType to an object of the format:
      //
      //     { typename: constructor function }
      //     
      // This causes the Chrome dev tools to pick up the typename as the actual display name
      // of the type, which is much better:
      //
      //     Vector3 {x: Float, y: Float, z: Float}
      // 
      // Restricting the typename as I did above should keep this from being used for
      // too much evil.
      // Bless me father, for I have sinned.
      var AtypicalType = eval("(function() { return {\n" +
         "\"" + implementation.typename + "\": function() {\n" +
            "this.init.apply(this, arguments);\n" +
            "}\n" +
            "};})()");

      var proto = Object.create(AT.Type.prototype);

      for (var element in implementation) {
         proto[element] = implementation[element];
      }

      AtypicalType[implementation.typename].prototype = proto;

      _types[implementation.typename] = AtypicalType[implementation.typename];
      
      // Initialize conversion metadata
      _conversions[implementation.typename] = {};
      _intermediaryConversionsFromAnySource[implementation.typename] = [];
      _intermediaryConversionsToAnyDestination[implementation.typename] = [];

      return AtypicalType[implementation.typename];
   };

   // Adds a conversion function to the global list of conversion functions, enabling it to
   // be used with Atypical.Type.convert.
   // If called multiple times with the same types, each call overrides the previous
   // conversion function.
   //
   // sourceTypename: The name of the type you're converting from. Must be a type that's
   //                 already been defined.
   // destinationTypename: The name of the type you're converting to. Must be a type that's
   //                      already been defined.
   // conversionFunction: A function, taking in one argument of the source type, that returns
   //                     a value of the destination type, to be used for conversion.
   AT.defineConversion = function(sourceTypename, destinationTypename, conversionFunction) {
      if (!( typeof sourceTypename === "string" 
         && typeof destinationTypename === "string"
         && typeof conversionFunction === "function"))
      {
         console.error("Error adding type conversion, incorrect arguments.");
         return;
      }
      if (conversionFunction.length !== 1) {
         console.error("Error adding type conversion, conversion function must be of exactly "
            + "one argument.");
         return;
      }
      if (!_types.hasOwnProperty(sourceTypename)) {
         console.error("Error adding type conversion, source type "
            + sourceTypename + " not defined.");
         return;
      }
      if (!_types.hasOwnProperty(destinationTypename)) {
         console.error("Error adding type conversion, destination type "
            + destinationTypename + " not defined.");
         return;
      }

      _conversions[sourceTypename][destinationTypename] = conversionFunction;

      // If either of these types are an intermediary type for conversions, update the conversion
      // map to account for the fact that this new conversion now exists.
      // In the following comments, call our source and destination types T and U and our newly-
      // defined conversion T -> U.
      
      // Update all conversions T -> U -> V where V has set U as an intermediary from any source.
      for (let i = 0; i < _intermediaryConversionsFromAnySource[destinationTypename].length; i++) {
         let finalTypename = _intermediaryConversionsFromAnySource[destinationTypename][i];
         // Don't override any conversions that have already been created
         if (!AT.canConvert(sourceTypename, finalTypename)) {
            AT.defineConversionsViaIntermediary(
               sourceTypename, destinationTypename, finalTypename);
         }
      }

      // Update all conversions V -> T -> U where V has set T as an intermediary to any destination.
      for (let i = 0; i < _intermediaryConversionsToAnyDestination[sourceTypename].length; i++) {
         let originalTypename = _intermediaryConversionsToAnyDestination[sourceTypename][i]; 
         // Don't override any conversions that have already been created
         if (!AT.canConvert(originalTypename, destinationTypename)) {
            AT.defineConversionsViaIntermediary(
               originalTypename, sourceTypename, destinationTypename);
         }
      }
   };

   // This function allows you to define a conversion between any two types S and D by using type T
   // as an intermediary. That is, when converting S to D, you first convert S to T and then T to D.
   //
   // The arguments correspond to the types as so:
   //
   // sourceTypename: The name of the S type as described above, that you'd like to convert from.
   //                 Must be a type that has already been defined.
   // intermediaryTypename: The name of the T type as described above. Must be a type that has
   //                       already been defined.
   // destinationTypename: The name of the D type as described above, that you'd like to convert to. 
   //                      Must be a type that has already been defined.
   //
   // This function can be used one of three ways:
   //
   // 1. Defining all of S, T, and D. This adds a single conversion function, S -> D,
   //    by converting S -> T -> D, and requires that conversion functions for S -> T and T -> D
   //    already exist.
   //
   // 2. Defining S and T, but leaving D null. This defines a set of conversion functions S -> D
   //    for EVERY type D that's currently defined and for which a conversion function T -> D exists.
   //
   // 3. Defining T and D, but leaving S null. This defines a set of conversions S -> D for EVERY
   //    type S that's currently defined and for which a conversion S -> T exists.
   //
   // Note that these must be null, not undefined or any other falsy value.
   //
   // If you have already specified a conversion between S and D, this function will overwrite
   // this previously-specified conversion. As such, it's best to call this before defining any
   // special-case custom conversion functions.
   //
   // These intermediary conversions will also attempt to update to reflect any new conversions
   // that are added. E.g. if you set a conversion S -> T -> D for all D, and then define a new
   // type Q, and a new conversion for T -> Q, then the Atypical system will create S -> Q via
   // S -> T -> Q unless a previous S -> Q conversion was already defined.
   AT.defineConversionsViaIntermediary = function(sourceTypename, intermediaryTypename,
                                                  destinationTypename)
   {
      // Whole bunch of error checking, thanks Javascript.
      if (typeof intermediaryTypename !== "string") {
         console.error("Error defining conversion via intermediary, intermediary typename "
            + "is not a string.");
      }
      if (!_types.hasOwnProperty(intermediaryTypename)) {
         console.error("Error defining conversion via intermediary, intermediary type "
            + intermediaryTypename + " not defined.");
         return;
      }
      if (intermediaryTypename === destinationTypename) {
         console.error("Error defining conversion via intermediary, destination type and "
            + "intermediary type are identical (" + intermediaryTypename + ")");
         return;
      }
      if (intermediaryTypename === sourceTypename) {
         console.error("Error defining conversion via intermediary, source type and "
            + "intermediary type are identical (" + intermediaryTypename + ")");
         return;
      }
      if (destinationTypename === null && sourceTypename === null) {
         console.error("Error defining conversion via intermediary, source type and destination "
            + "type cannot both be null.")
      }
      if (destinationTypename === sourceTypename) {
         console.error("Error defining conversion via intermediary, source type and "
            + "destination type are identical (" + sourceTypename + ")");
         return;
      }
      
      if (sourceTypename === null) {
         // Define S -> T -> D for all S.
         if (typeof destinationTypename !== "string") {
            console.error("Error defining conversion via intermediary, destination typename must "
               + "be a string when sourceTypename is null.");
         }
         if (!_types.hasOwnProperty(destinationTypename)) {
            console.error("Error defining conversion via intermediary, destination type "
               + destinationTypename + " not defined.");
            return;
         }

         let conversionToDestination = _conversions[intermediaryTypename][destinationTypename];
         if (!conversionToDestination) {
            console.error("Attempted to set " + intermediaryTypename + " as an intermediary for "
               + "conversions to " + destinationTypename
               + ", but no conversion between the two types exists.");
            return;
         }

         for (let sourceTypename in _conversions) {
            if (_conversions[sourceTypename][intermediaryTypename]
               && sourceTypename !== destinationTypename)
            {
               let conversionToIntermediary = _conversions[sourceTypename][intermediaryTypename];
               _conversions[sourceTypename][destinationTypename] = function(value) {
                  return conversionToDestination(conversionToIntermediary(value));
               }
            }
         }

         _intermediaryConversionsFromAnySource[intermediaryTypename].push(destinationTypename);
      }
      else if (destinationTypename === null) {
         // Define S -> T -> D for all D.
         if (typeof sourceTypename !== "string") {
            console.error("Error defining conversion via intermediary, source typename must "
               + "be a string when destinationTypename is null.");
         }
         if (!_types.hasOwnProperty(sourceTypename)) {
            console.error("Error defining conversion via intermediary, source type "
               + sourceTypename + " not defined.");
            return;
         }

         let conversionToIntermediary = _conversions[sourceTypename][intermediaryTypename];
         if (!conversionToIntermediary) {
            console.error("Attempted to set " + intermediaryTypename + " as an intermediary for "
               + "conversions from " + sourceTypename
               + ", but no conversion between the two types exists.");
            return;
         }

         for (let destinationTypename in _conversions) {
            if (_conversions[intermediaryTypename][destinationTypename]
               && intermediaryTypename !== destinationTypename)
            {
               let conversionToDestination = _conversions[intermediaryTypename][destinationTypename];
               _conversions[sourceTypename][destinationTypename] = function(value) {
                  return conversionToDestination(conversionToIntermediary(value));
               }
            }
         }

         _intermediaryConversionsToAnyDestination[intermediaryTypename].push(sourceTypename);
      }
      else {
         // Define S -> T -> D for specifc S and D.
         if (typeof sourceTypename !== "string") {
            console.error("Error defining conversion via intermediary, source typename must "
               + "be a string or null.");
         }
         if (!_types.hasOwnProperty(sourceTypename)) {
            console.error("Error defining conversion via intermediary, source type "
               + sourceTypename + " not defined.");
            return;
         }
         if (typeof destinationTypename !== "string") {
            console.error("Error defining conversion via intermediary, destination typename must "
               + "be a string or null.");
         }
         if (!_types.hasOwnProperty(destinationTypename)) {
            console.error("Error defining conversion via intermediary, destination type "
               + destinationTypename + " not defined.");
            return;
         }

         let conversionToIntermediary = _conversions[sourceTypename][intermediaryTypename];
         if (!conversionToIntermediary) {
            console.error("Attempted to set " + intermediaryTypename + " as an intermediary for "
               + "conversions from " + sourceTypename + " to " + destinationTypename
               + ", but no conversion between " + sourceTypename + " and "
               + intermediaryTypename + " exists.");
            return;
         }

         let conversionToDestination = _conversions[intermediaryTypename][destinationTypename];
         if (!conversionToDestination) {
            console.error("Attempted to set " + intermediaryTypename + " as an intermediary for "
               + "conversions from " + sourceTypename + " to " + destinationTypename
               + ", but no conversion between " + intermediaryTypename + " and "
               + destinationTypename + " exists.");
            return;
         }
         _conversions[sourceTypename][destinationTypename] = function(value) {
            return conversionToDestination(conversionToIntermediary(value));
         }
      }
   };

   // Construction error. Meant to be thrown in a type's constructor if the type was instantiated
   // with incorrect arguments.
   AT.ConstructionError = function(message) { this.init(message); };
   AT.ConstructionError.prototype = {
      init: function(message) {
         this.name = "ConstructionError";
         this.message = (message || "Type was constructed with incorrect arguments");
      }
   };

   // Type definitions start here.

   AT.String = AT.defineType({
      typename: "String",
      init: function(s) {
         this._def("str", "" + s);
      },
   });

   AT.Float = AT.defineType({
      typename: "Float",
      init: function(n) {
         if (n instanceof Number) {
            n = n.valueOf();
         }
         if (isNaN(n)) {
            throw new AT.ConstructionError("Float constructed with non-numerical input ("+n+")");
         }
         this._def("n", n);
      }
   });
   AT.defineConversion("Float", "String", function(f) {
      return new AT.String("" + f.n.toFixed(3));
   });
   AT.defineConversion("String", "Float", function(str) {
      var num = parseFloat(str.str);
      if (isNaN(num)) {
         return new AT.Float(0);
      }
      else {
         return new AT.Float(num);
      }
   });

   AT.Vector3 = AT.defineType({
      typename: "Vector3",
      init: function(x, y, z) {
         if (x instanceof AT.Float && y instanceof AT.Float && z instanceof AT.Float) {
            this._def("x", x);
            this._def("y", y);
            this._def("z", z);
         }
         else {
            // AT.Float will take care of validating our arguments.
            this._def("x", new AT.Float(x));
            this._def("y", new AT.Float(y));
            this._def("z", new AT.Float(z));
         }
      },
      magnitude: function() {
         return sqrt(this.x.n*this.x.n + this.y.n*this.y.n + this.z.n*this.z.n);
      }
   });
   AT.defineConversion("Vector3", "Float", function(vec) {
      return new AT.Float(vec.magnitude());
   });
   AT.defineConversion("Float", "Vector3", function(r) {
      return new AT.Vector3(new AT.Float(r.n), new AT.Float(r.n), new AT.Float(r.n));
   });
   AT.defineConversion("Vector3", "String", function(v) {
      return new AT.String("(" + v.x.convert("String").str
         + ", " + v.y.convert("String").str + ", " + v.z.convert("String").str + ")");
   });
   AT.defineConversion("String", "Vector3", function(str) {
      let numbers = str.str.split(/[^\d\.\+-eE]/).map(parseFloat).filter(
         function(n) { return !isNaN(n); }
      );
      return new AT.Vector3(numbers[0] || 0, numbers[1] || 0, numbers[2] || 0);
   });

   AT.Int = AT.defineType({
      typename: "Int",
      init: function(n) {
         if (n instanceof Number) {
            n = n.valueOf();
         }
         this._def("n", Math.round(n));
      }
   });
   AT.defineConversion("Float", "Int", function(num) {
      try {
         return new AT.Int(num.n);
      }
      catch (error) {
         if (error instanceof AT.ConstructionError) {
            return undefined;
         }
         else {
            throw error;
         }
      }
   });
   AT.defineConversion("Int", "Float", function(i) {
      return new AT.Float(i.n);
   });
   AT.defineConversionsViaIntermediary(null, "Float", "Int");
   AT.defineConversionsViaIntermediary("Int", "Float", null);
   // Define a custom conversion to string. The float intermediary already gives us conversion
   // from string for free, but we want our ints to print without decimal places.
   AT.defineConversion("Int", "String", function(i) {
      return new AT.String("" + i.n)
   });
   

   AT.Bool = AT.defineType({
      typename: "Bool",
      init: function(b) {
         this._def("b", !!b);
      },
      not: function() {
         return new AT.Bool(!this.b);
      },
      and: function(other) {
         return new AT.Bool(this.b && other.b);
      },
      or: function(other) {
         return new AT.Bool(this.b || other.b);
      },
      xor: function(other) {
         return new AT.Bool(this.b !== other.b);
      }
   });
   AT.defineConversion("Bool", "String", function(b) {
      return new AT.String(b.b ? "true" : "false");
   });
   AT.defineConversion("String", "Bool", function(str) {
      var lower = str.str.toLowerCase();
      return new AT.Bool(lower !== "false" && lower !== "0" && lower !== "f");
   });
   AT.defineConversion("Int", "Bool", function(i) {
      return new AT.Bool(i.n);
   });
   AT.defineConversion("Float", "Bool", function(num) {
      return new AT.Bool(Math.abs(num.n) > 0.001);
   });
   AT.defineConversion("Vector3", "Bool", function(v) {
      let notZero = (Math.abs(v.x) > 0.001 || Math.abs(v.y) > 0.001 || Math.abs(v.z) > 0.001);
      return new AT.Bool(notZero);
   });
   AT.defineConversion("Bool", "Int", function(b) {
      return new AT.Int(b.b ? 1 : 0);
   });
   AT.defineConversion("Bool", "Float", function(b) {
      return new AT.Float(b.b ? 1 : 0);
   });
   AT.defineConversion("Bool", "Vector3", function(b) {
      return new AT.Vector3(0, b.b ? 1 : 0, 0);
   });


   return AT;
}())

// Convenience alias to make it easier to type.
var AT = Atypical;