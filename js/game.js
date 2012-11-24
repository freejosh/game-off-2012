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
			ctx.fillText('Game Off', 40, (pc.device.canvasHeight / 2)-50);
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

var PhysicsConst = {
	GRAVITY: 70
};

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
				gravity: { x: 0, y: PhysicsConst.GRAVITY },
				debug: pc.device.devMode,
				tileCollisionMap: {
					tileMap: this.boundLayer.tileMap,
					collisionCategory: CollisionType.WALL,
					collisionMask: CollisionType.PLAYER
				}
			}));
			this.gameLayer.addSystem(new PlayerControlSystem());

			this.playerToFollow = this.gameLayer.entityManager.getTagged('player').first.object();

			this.boundLayer.setOriginTrack(this.gameLayer);
			this.backgroundLayer.setOriginTrack(this.gameLayer);
		},

		process: function() {

			var playerCenter = this.playerToFollow.getComponent('spatial').getCenterPos();
			var viewport = this.viewPort;
			this.gameLayer.setOrigin(playerCenter.x - viewport.w / 2, playerCenter.y - viewport.h / 2);
			
			pc.device.ctx.clearRect(0, 0, pc.device.canvasWidth, pc.device.canvasHeight);
			this._super();
		}
	}
);

var Clonable = pc.components.Component('clonable',
	{
		create: function(stats) {
			var component = this._super();
			component.config(stats);
			return component;
		}
	},
	{
		DEVIATION_LIMIT: 1,
		defaults: {
			speed: 2,
			jump: 2
		},

		init: function() {
			this._super(this.Class.shortName);
			this.config(this.defaults);
		},

		config: function(stats) {
			if (!stats) return;
			this.speed = stats.speed;
			this.jump = stats.jump;
		},

		/**
		 * Creates a clone of the entity, increasing the chosen stat on the
		 * cloned entity, and decreasing it on the original.
		 *
		 * @param String stat The stat to increase by 1.
		 */
		clone: function(stat) {
			var entity = this.getEntity();
			var clonable = entity.getComponent('clonable');

			if (Math.abs(clonable[stat] - this.defaults[stat]) >= this.DEVIATION_LIMIT) return;

			var spatial = entity.getComponent('spatial');
			var position = spatial.getPos();
			
			var entity2 = entity.layer.scene.entityFactory.createEntity(entity.layer, 'player', position.x, position.y);
			var clonable2 = entity2.getComponent('clonable');
			
			clonable[stat]--;
			clonable2[stat]++;
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
				e.addTag('player');

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
					maxSpeed: { x: 24, y: 999 },
					friction: 1,
					fixedRotation: true,
					bounce: 0,
					mass: 1,
					collisionCategory: CollisionType.PLAYER,
					collisionMask: CollisionType.WALL
				}));

				if (layer.entityManager.getTagged('player').length() === 1) {

					e.addComponent(pc.components.Input.create({
						states:[
							['running right', ['D', 'RIGHT']],
							['running left', ['A', 'LEFT']],
							['jumping', ['W', 'UP']]
						],

						actions: [
							['clone', ['C']],
							['control', ['R']]
						],

						target: e
					}));

				}

				e.addComponent(Clonable.create());
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

			var target = entity.getComponent('input').target;
			var physics = target.getComponent('physics');
			var sprite = target.getComponent('sprite').sprite;
			var stats = target.getComponent('clonable');

			if (this.isInputState(entity, 'running right')) {
				physics.applyImpulse(1 * stats.speed, 0);
				if (sprite.currentAnimName !== 'running right') sprite.setAnimation('running right');
			}

			if (this.isInputState(entity, 'running left')) {
				physics.applyImpulse(1 * stats.speed, 180);
				if (sprite.currentAnimName !== 'running left') sprite.setAnimation('running left');
			}

			if (this.isInputState(entity, 'jumping') && physics.onGround && physics.getLinearVelocity().y === 0) {
				physics.applyImpulse(PhysicsConst.GRAVITY * stats.jump / 16, 270);
				physics.onGround = false;
			}
		},

		onAction: function(action) {
			
			var playerList = this.layer.entityManager.getTagged('player');
			// input only added to first player entity
			var input = playerList.first.object().getComponent('input');
			// get currently controlled player
			var player = input.target;
			
			var clonable;
			if (action === 'clone') {
				clonable = player.getComponent('clonable');

				// TODO: show stats chooser

				// TODO: call with chosen stat
				clonable.clone('jump');
				return;
			}

			var playerNode, nextPlayer;
			if (action === 'control') {
				// move control target to next player
				playerNode = playerList.getNode(player);
				nextPlayer = playerNode.next();
				if (!nextPlayer) nextPlayer = playerList.first;
				input.target = nextPlayer.object();
				player.layer.scene.playerToFollow = input.target;
				return;
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
		onCollisionStart: function(aType, bType, entityA, entityB, fixtureAType, fixtureBType) {

			// player hitting ground
			var entity;
			if (aType === pc.BodyType.TILE) entity = entityB;
			else if (bType === pc.BodyType.TILE) entity = entityA;
			
			if (entity.hasTag('player')) {
				entity.getComponent('physics').onGround = true;
			}
		}
	}
);