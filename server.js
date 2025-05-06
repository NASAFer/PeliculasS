const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const bodyParser = require('body-parser');
const LocalStrategy = require('passport-local');
const passportLocalMongoose = require('passport-local-mongoose');
const session = require('express-session');
const User = require('./model/User');
const Pelicula = require('./model/Pelicula');

const app = express();

mongoose.connect('mongodb://127.0.0.1:27017/peliculas', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("Conectado a MongoDB - Base de datos: peliculas");
}).catch((err) => {
  console.log("Error de conexión:", err);
});

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "secretoSuperSeguro",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware global para EJS
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

app.get("/", async (req, res) => {
  const query = req.query.q || ""; // Captura el término de búsqueda si lo hay
  try {
    const peliculas = await Pelicula.find({}).populate('usuario');
    res.render("index", { peliculas, query }); // Pasa el query a la vista
  } catch (err) {
    console.log("Error cargando películas:", err);
    res.send("Error cargando películas.");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const { username, password, email } = req.body;
  const esAdmin = false; // Cambia esto a true para crear un admin manualmente
  User.register(new User({ username, email, esAdmin }), password, (err, user) => {
    if (err) {
      console.log("Error registrando usuario:", err);
      return res.redirect("/register");
    }
    passport.authenticate("local")(req, res, () => {
      res.redirect("/secret");
    });
  });
});

app.post("/login", passport.authenticate("local", {
  successRedirect: "/secret",
  failureRedirect: "/login"
}));

app.get("/secret", isLoggedIn, async (req, res) => {
  const query = req.query.q || ""; // Captura el término de búsqueda si lo hay
  try {
    const peliculas = await Pelicula.find({}).populate('usuario');
    res.render("secret", { peliculas, query }); // Pasa el query a la vista
  } catch (err) {
    console.log("Error mostrando películas:", err);
    res.send("Error cargando películas.");
  }
});

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

// ------------------- CRUD PELÍCULAS -------------------

app.get("/peliculas/agregar", isLoggedIn, (req, res) => {
  res.render("agregar");
});

app.post("/peliculas/agregar", isLoggedIn, async (req, res) => {
  try {
    const { titulo, actores, anio, categoria, sinopsis, imagen } = req.body;
    const nuevaPelicula = new Pelicula({
      Título: titulo,
      Actores: actores.split(',').map(actor => actor.trim()),
      Año: anio,
      Categoría: categoria,
      Sinopsis: sinopsis,
      Imagen: imagen,
      usuario: req.user._id // 👈 relación con el usuario que la agrega
    });
    await nuevaPelicula.save();
    res.redirect("/secret");
  } catch (err) {
    console.log("Error agregando película:", err);
    res.send("Error al agregar película.");
  }
});

app.get("/peliculas/:id/editar", isLoggedIn, async (req, res) => {
  try {
    const pelicula = await Pelicula.findById(req.params.id);
    if (!pelicula.usuario.equals(req.user._id)) {
      return res.send("No tienes permiso para editar esta película.");
    }
    res.render("editar", { pelicula });
  } catch (err) {
    console.log("Error cargando película para editar:", err);
    res.send("Error cargando.");
  }
});

app.post("/peliculas/:id/editar", isLoggedIn, async (req, res) => {
  try {
    const pelicula = await Pelicula.findById(req.params.id);
    if (!pelicula.usuario.equals(req.user._id)) {
      return res.send("No tienes permiso para editar esta película.");
    }
    const { titulo, actores, anio, categoria, sinopsis, imagen } = req.body;
    pelicula.Título = titulo;
    pelicula.Actores = actores.split(',').map(actor => actor.trim());
    pelicula.Año = anio;
    pelicula.Categoría = categoria;
    pelicula.Sinopsis = sinopsis;
    pelicula.Imagen = imagen;
    await pelicula.save();
    res.redirect("/secret");
  } catch (err) {
    console.log("Error actualizando película:", err);
    res.send("Error al editar.");
  }
});

app.post("/peliculas/:id/eliminar", isLoggedIn, async (req, res) => {
  try {
    const pelicula = await Pelicula.findById(req.params.id);
    if (!req.user.esAdmin) {
      return res.send("Solo el administrador puede eliminar películas.");
    }
    await Pelicula.findByIdAndDelete(req.params.id);
    res.redirect("/secret");
  } catch (err) {
    console.log("Error eliminando película:", err);
    res.send("Error eliminando película.");
  }
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

// ----------- Ruta para crear administrador (solo una vez, luego eliminar) -----------

app.get("/crear-admin", async (req, res) => {
  try {
    const existe = await User.findOne({ username: "admin" });
    if (existe) return res.send("El usuario administrador ya existe.");

    const nuevoAdmin = new User({ username: "admin", email: "admin@email.com", esAdmin: true });
    await User.register(nuevoAdmin, "admin123");
    res.send("Administrador creado con éxito.");
  } catch (err) {
    console.log("Error creando admin:", err);
    res.send("Error al crear administrador.");
  }
});

// ------------------- BÚSQUEDA DE PELÍCULAS -------------------

app.get("/buscar", async (req, res) => {
  const query = req.query.q; // Obtener el término de búsqueda
  try {
    const peliculas = await Pelicula.find({
      $or: [
        { Título: { $regex: query, $options: "i" } },
        { Actores: { $regex: query, $options: "i" } },
        { Categoría: { $regex: query, $options: "i" } },
        { Sinopsis: { $regex: query, $options: "i" } }
      ]
    }).populate('usuario');
    res.render("busqueda", { peliculas, query }); // Pasa el query a la vista 'busqueda'
  } catch (err) {
    console.log("Error en búsqueda:", err);
    res.send("Error al buscar.");
  }
});

const port = 8080;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
