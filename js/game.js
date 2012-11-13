var TheGame = pc.Game.extend('TheGame',
	{},
	{
		gameScene: null,

		onReady: function() {
			this._super();
			if (pc.device.devMode) pc.device.loader.setDisableCache();

			// add resources
			pc.device.loader.add(new pc.DataResource('level1', 'data/level1.tmx'));
			pc.device.loader.add(new pc.Image('background_tileset', 'images/background_tileset.png'));
			pc.device.loader.add(new pc.Image('player', 'images/gripe.run_right.png'));

			// start loading
			pc.device.loader.start(this.onLoading.bind(this), this.onLoaded.bind(this));
		},

		onLoading: function(percentageComplete) {
			var ctx = pc.device.ctx;
			ctx.clearRect(0,0,pc.device.canvasWidth, pc.device.canvasHeight);
			ctx.font = "normal 50px Times";
			ctx.fillStyle = "#bbb";
			ctx.fillText('Scrollia', 40, (pc.device.canvasHeight / 2)-50);
			ctx.font = "normal 14px Verdana";
			ctx.fillStyle = "#000";
			ctx.fillText('Loading: ' + percentageComplete + '%', 40, pc.device.canvasHeight/2);
		},

		onLoaded:function() {
			this.gameScene = new GameScene();
			this.addScene(this.gameScene);
		}
	}
);

var GameScene = pc.Scene.extend('GameScene',
	{},
	{
		init: function() {
			this._super();

			this.entityFactory = new EntityFactory();

			this.loadFromTMX(pc.device.loader.get('level1').resource, this.entityFactory);

			this.boundLayer = this.get('boundaries');
			this.boundLayer.setZIndex(0);

			this.backgroundLayer = this.get('background');
			this.backgroundLayer.setZIndex(1);

			this.gameLayer = this.get('entities');
			this.gameLayer.setZIndex(2);
			this.gameLayer.addSystem(new pc.systems.Render());
			this.gameLayer.addSystem(new GamePhysics({
				gravity: { x: 0, y: 70 },
				debug: pc.device.devMode,
				tileCollisionMap: {
					tileMap: this.boundLayer.tileMap,
					collisionCategory: CollisionType.WALL,
					collisionMask: CollisionType.PLAYER
				}
			}));
			this.gameLayer.addSystem(new PlayerControlSystem());
		},

		process: function() {
			pc.device.ctx.clearRect(0, 0, pc.device.canvasWidth, pc.device.canvasHeight);
			this._super();
		}
	}
);

var EntityFactory = pc.EntityFactory.extend('EntityFactory',
	{},
	{
		playerSheet: null,

		init: function() {
			// setup sprite sheets

			this.playerSheet = new pc.SpriteSheet({
				image: pc.device.loader.get('player').resource,
				frameWidth: 32,
				frameHeight: 32,
				useRotation: true
			});
			this.playerSheet.addAnimation({ name: 'running right',	frameX: 0,	frameY: 0,	frameCount: 8,	time: 900 });
			this.playerSheet.addAnimation({ name: 'running left',	frameX: 0,	frameY: 0,	frameCount: 8,	time: 900,	scaleX: -1, offsetX: 32, offsetY: 16 });
		},

		createEntity: function(layer, type, x, y) {
			var e = null;

			if (type === 'player') {
				
				e = pc.Entity.create(layer);

				e.addComponent(pc.components.Sprite.create({
					spriteSheet: this.playerSheet,
					animationStart: 'running right'
				}));

				e.addComponent(pc.components.Spatial.create({
					x: x,
					y: y,
					w: this.playerSheet.frameWidth,
					h: this.playerSheet.frameHeight
				}));

				e.addComponent(pc.components.Physics.create({
					maxSpeed: { x: 24, y: 150 },
					friction: 1,
					fixedRotation: true,
					bounce: 0,
					mass: 1,
					collisionCategory: CollisionType.PLAYER,
					collisionMask: CollisionType.WALL
				}));

				e.addComponent(pc.components.Input.create({
					states:[
						['running right', ['D', 'RIGHT']],
						['running left', ['A', 'LEFT']],
						['jumping', ['W', 'UP']]
					]
				}));
			}

			return e;
		}
	}
);

var PlayerControlSystem = pc.systems.Input.extend('PlayerControlSystem',
	{},
	{
		process: function(entity) {
			this._super(entity);

			var physics = entity.getComponent('physics');
			var sprite = entity.getComponent('sprite').sprite;

			if (this.isInputState(entity, 'running right')) {
				physics.applyImpulse(1, 0);
				if (sprite.currentAnimName !== 'running right') sprite.setAnimation('running right');
			}

			if (this.isInputState(entity, 'running left')) {
				physics.applyImpulse(1, 180);
				if (sprite.currentAnimName !== 'running left') sprite.setAnimation('running left');
			}
		}
	}
);

var CollisionType = {
	NONE: 0,
	WALL: 1,
	PLAYER: 2
};

var GamePhysics = pc.systems.Physics.extend('GamePhysics',
	{},
	{

	}
);