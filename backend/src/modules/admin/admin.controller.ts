import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards, StreamableFile } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ProcessManagerService } from './process-manager.service';
import { PatrolService } from '../patrol/patrol.service';
import { LocalIpGuard } from './local-ip.guard';
import { Public } from '../../common/decorators/public.decorator';
import {
  CreateUsersDto, UserListQueryDto, UpdateUserDto, UserIdParamDto,
  BatchUpdateUsersDto, SetUidDto,
} from './dto/admin.dto';
import { SpotImageViewQueryDto } from '../patrol/dto/patrol.dto';

@Controller('admin')
@UseGuards(LocalIpGuard)
@Public()
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly procs: ProcessManagerService,
    private readonly patrols: PatrolService,
  ) {}

  /** 创建账号(仅本机/局域网可调) */
  @Post('users')
  createUsers(@Body() dto: CreateUsersDto) {
    return this.admin.createUsers(dto.nickname ?? '督学员', dto.count ?? 1);
  }

  /** 用户列表(分页/搜索/状态过滤) */
  @Get('users')
  listUsers(@Query() q: UserListQueryDto) {
    return this.admin.listUsers(q.page ?? 1, q.size ?? 20, q.keyword, q.status);
  }

  /** 用户聚合详情 */
  @Get('users/:id')
  userDetail(@Param() p: UserIdParamDto) {
    return this.admin.userDetail(p.id);
  }

  /** 实时获取用户状态(在线/当前状态/已开始时长/违规) */
  @Get('users/:id/realtime')
  realtimeStatus(@Param() p: UserIdParamDto) {
    return this.admin.realtimeStatus(p.id);
  }

  /** 批量调整用户(改昵称/启用禁用) — 必须放在 users/:id 之前避免 'batch' 被当 :id */
  @Patch('users/batch')
  batchUpdateUsers(@Body() dto: BatchUpdateUsersDto) {
    return this.admin.batchUpdateUsers(dto.ids, { nickname: dto.nickname, status: dto.status });
  }

  /** 设置/修改用户 uid(8 位) — 同上需在 users/:id 之前 */
  @Put('users/:id/uid')
  setUserUid(@Param() p: UserIdParamDto, @Body() dto: SetUidDto) {
    return this.admin.setUserUid(p.id, dto.uid);
  }

  /** 改昵称 / 禁用启用 */
  @Patch('users/:id')
  updateUser(@Param() p: UserIdParamDto, @Body() dto: UpdateUserDto) {
    return this.admin.updateUser(p.id, dto);
  }

  /** 删除用户(级联清理) */
  @Delete('users/:id')
  deleteUser(@Param() p: UserIdParamDto) {
    return this.admin.deleteUser(p.id);
  }

  /** 全局统计(面板顶部条) */
  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  // ---------- 突击检查(admin 侧) ----------

  /** 发起突击检查(给指定 user 落 pending 任务, 返回在线/可抓帧提示) */
  @Post('patrol/spot/:userId')
  spotCheck(@Param('userId') userId: string) {
    return this.patrols.createSpotCheck(userId);
  }
  /** 突击检查历史 */
  @Get('patrol/spot/:userId')
  spotHistory(@Param('userId') userId: string) {
    return this.patrols.listUserSpotChecks(userId);
  }

  /** 查看突击检查原图 */
  @Get('patrol/spot/:userId/image')
  async spotImage(@Param('userId') userId: string, @Query() q: SpotImageViewQueryDto) {
    const buf = await this.patrols.getSpotImage(userId, q.taskId);
    return new StreamableFile(buf, { type: 'image/jpeg', disposition: 'inline' });
  }

  /** 删除突击检查图 */
  @Delete('patrol/spot/:userId/image')
  spotDeleteImage(@Param('userId') userId: string, @Query() q: SpotImageViewQueryDto) {
    return this.patrols.deleteSpotImage(userId, q.taskId);
  }

  // ---------- 进程控制(启停本项目 4 个服务) ----------

  /** 进程状态列表 */
  @Get('processes/status')
  procStatus() {
    return this.procs.status();
  }

  /** 启动进程 */
  @Post('processes/start')
  procStart(@Body('name') name: string) {
    return this.procs.start(name);
  }

  /** 停止进程(api 为延迟自杀) */
  @Post('processes/stop')
  procStop(@Body('name') name: string) {
    return this.procs.stop(name);
  }

  /** 重启进程(api 走守护脚本) */
  @Post('processes/restart')
  procRestart(@Body('name') name: string) {
    return this.procs.restart(name);
  }

  /** 一键全停 */
  @Post('processes/stop-all')
  procStopAll() {
    return this.procs.stopAll();
  }
}
