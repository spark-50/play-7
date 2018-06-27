const Discord = require('discord.js');
const bot = new Discord.Client();
const fs = require('fs');

const { Client, Util } = require('discord.js');

const { TOKEN, PREFIX, GOOGLE_API_KEY } = require('./config');

const YouTube = require('simple-youtube-api');

const ytdl = require('ytdl-core');

const child_process = require("child_process");



const client = new Client({ disableEveryone: true });



const youtube = new YouTube(GOOGLE_API_KEY);



const queue = new Map();



client.on('warn', console.warn);



client.on('error', console.error);



client.on('ready', () => console.log('Yo this ready!'));



client.on('disconnect', () => console.log('I just disconnected, making sure you know, I will reconnect now...'));



client.on('reconnecting', () => console.log('I am reconnecting now!'));


client.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return undefined;
	var embed = new Discord.RichEmbed()
	if (!msg.content.startsWith(PREFIX)) return undefined;



	const args = msg.content.split(' ');

	const searchString = args.slice(1).join(' ');

	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';

	const serverQueue = queue.get(msg.guild.id);



	let command = msg.content.toLowerCase().split(" ")[0];

	command = command.slice(PREFIX.length)

	if (command === `p`) {
    
		const voiceChannel = msg.member.voiceChannel;
        
		if (!voiceChannel) return msg.channel.send('المفروض تكون فروم يا حلو');

		const permissions = voiceChannel.permissionsFor(msg.client.user);

		if (!permissions.has('CONNECT')) {

			return msg.channel.send('ما بقدر ادخل هذا الروم ادخل روم ثاني');

		}

		if (!permissions.has('SPEAK')) {

			return msg.channel.send('ما بقدر اسمعك اشي لانو ماعندي الصلاحيات');

		}



		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {

			const playlist = await youtube.getPlaylist(url);

			const videos = await playlist.getVideos();

			for (const video of Object.values(videos)) {

				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop

				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop

			}

			return msg.channel.send(`✅ Playlist: **${playlist.title}** تمت الاضافة الى قائمة الانتضار`);

		} else {

			try {

				var video = await youtube.getVideo(url);

			} catch (error) {

				try {

					var videos = await youtube.searchVideos(searchString, 10);

					let index = 0;

					const embed1 = new Discord.RichEmbed()
			        .setDescription(`**اختار رقم المقطع** :
${videos.map(video2 => `[**${++index} **] \`${video2.title}\``).join('\n')}`)
					.setFooter("")
					msg.channel.sendEmbed(embed1).then(message =>{message.delete(20000)})
					// eslint-disable-next-line max-depth


					// eslint-disable-next-line max-depth

					try {

						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {

							maxMatches: 1,

							time: 10000,

							errors: ['time']

						});

					} catch (err) {

						console.error(err);

						return msg.channel.send('No or invalid value entered, cancelling video selection.');

					}

					const videoIndex = parseInt(response.first().content);

					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);

				} catch (err) {

					console.error(err);

					return msg.channel.send('🆘 لم يتم العثور على اي نتيجة بحث');

				}

			}

			return handleVideo(video, msg, voiceChannel);

		}
    
	} else if (command === `skip`) {

		if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');

		if (!serverQueue) return msg.channel.send('There is nothing playing that I could skip for you.');

		serverQueue.connection.dispatcher.end('تم استخدم امر التخطي');

		return undefined;

	} else if (command === `stop`) {

		if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');

		if (!serverQueue) return msg.channel.send('There is nothing playing that I could stop for you.');

		serverQueue.songs = [];

		serverQueue.connection.dispatcher.end('تم استخدام امر التوقف بالفعل');

		return undefined;

	} else if (command === `vol`) {

		if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');

		if (!serverQueue) return msg.channel.send('There is nothing playing.');

		if (!args[1]) return msg.channel.send(`The current volume is: **${serverQueue.volume}**`);

		serverQueue.volume = args[1];

		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);

		return msg.channel.send(`I set the volume to: **${args[1]}**`);

	} else if (command === `np`) {

		if (!serverQueue) return msg.channel.send('لا يوجد شئ لتشغيله');

		return msg.channel.send(`🎶 Now playing: **${serverQueue.songs[0].title}**`);

	} else if (command === `queue`) {

		if (!serverQueue) return msg.channel.send('There is nothing playing.');

		return msg.channel.send(`

__**Song queue:**__



${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}



**Now playing:** ${serverQueue.songs[0].title}

		`);

	} else if (command === `pause`) {

		if (serverQueue && serverQueue.playing) {

			serverQueue.playing = false;

			serverQueue.connection.dispatcher.pause();

			return msg.channel.send('⏸ تم توقيف الموسيقى مؤقتا!');

		}

		return msg.channel.send('There is nothing playing.');

	} else if (command === `resume`) {

		if (serverQueue && !serverQueue.playing) {

			serverQueue.playing = true;

			serverQueue.connection.dispatcher.resume();

			return msg.channel.send('▶ تم استأناف الاغنبة');

		}

		return msg.channel.send('لا يوجد شئ قيد التشغيل.');

	}



	return undefined;

});


async function handleVideo(video, msg, voiceChannel, playlist = false) {

	const serverQueue = queue.get(msg.guild.id);

	console.log(video);

	const song = {

		id: video.id,

		title: Util.escapeMarkdown(video.title),

		url: `https://www.youtube.com/watch?v=${video.id}`

	};

	if (!serverQueue) {

		const queueConstruct = {

			textChannel: msg.channel,

			voiceChannel: voiceChannel,

			connection: null,

			songs: [],

			volume: 5,

			playing: true

		};

		queue.set(msg.guild.id, queueConstruct);



		queueConstruct.songs.push(song);



		try {

			var connection = await voiceChannel.join();

			queueConstruct.connection = connection;

			play(msg.guild, queueConstruct.songs[0]);

		} catch (error) {

			console.error(`I could not join the voice channel: ${error}`);

			queue.delete(msg.guild.id);

			return msg.channel.send(`لم استطيع دخول الروم الصوتي: ${error}`);

		}

	} else {

		serverQueue.songs.push(song);

		console.log(serverQueue.songs);

		if (playlist) return undefined;

		else return msg.channel.send(`✅ **${song.title}** تمت اضافتها الى قائمة الانتضار`);

	}

	return undefined;

}



function play(guild, song) {

	const serverQueue = queue.get(guild.id);



	if (!song) {

		serverQueue.voiceChannel.leave();

		queue.delete(guild.id);

		return;

	}

	console.log(serverQueue.songs);



	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))

		.on('end', reason => {

			if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');

			else console.log(reason);

			serverQueue.songs.shift();

			play(guild, serverQueue.songs[0]);

		})

		.on('error', error => console.error(error));

	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);



	serverQueue.textChannel.send(`🎶 Start playing: **${song.title}**`);

}

const adminprefix = "rw";
const devs = ['234454368072630283', '403312268223447040'];

client.on('message', message => {
  var argresult = message.content.split(` `).slice(1).join(' ');
    if (!devs.includes(message.author.id)) return;
if(message.content === adminprefix + "restart") {
  if (!devs.includes(message.author.id)) return;
      message.channel.send(`:warning:️ **Bot restarting by ${message.author.username}**`);
    console.log("\n\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    console.log(`⚠️ Bot restarting... ⚠️`);
    console.log("===============================================\n\n");
    client.destroy();
    child_process.fork(__dirname + "/bot.js");
    console.log(`Bot Successfully Restarted`);
}

});
 


client.on("message", message => {
 if (message.content === "Hhelp") {
        message.react("❤")
           message.react("📬")
  const embed = new Discord.RichEmbed() 
      .setColor("#ffff00")
      .setDescription(`

 _________________ 
     1p
     امر تشغيل الأغنية , !شغل الرابط او اسم الأعنية
     rwskip
     تغير الأغنية
     rwpause
     ايقاف الأغنية
     rwresume
     مواصلة الأغنية
     rwvol
   لتغيير درجه الصوت 1-9
     rwstop
     خروج البوت من الروم

 `)
 
   message.author.sendEmbed(embed)
    
   }
   }); 
 

client.on("ready", () => {
client.user.setPresence({
  status: 'online', //الحال
  game: {
     type: 0,
     name: 'Pirates.🔥|rwhelp',    
     details: `🎈r-help🎈`,  
     url: 'http://twitch.tv/Streammingg',
     state: `.`,
    application_id: '431836563379322880',
     assets: {
        small_image: `448884736903872515`, 
        small_text: 'rv clan' ,
        large_image: `448885134960361473`, 
        large_text: `r-help` } 
 
  }
    });
});




client.login(process.env.BOT_TOKEN);
